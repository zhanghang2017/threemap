import * as THREE from "three";
import tinycolor from "tinycolor2";
import wallImage from "@/assets/images/map-wall.png";
import type { ThreeMapContext, ThreeMapOptions, GeoJsonFeature, MapConfig } from "../types";

// 加载墙体纹理（垂直渐变的半透明贴图）
const wallTexture = new THREE.TextureLoader().load(wallImage);

/**
 * 根据路径创建墙体 Mesh - 生成垂直站立的墙面
 *
 * 几何构造原理：
 * 1. 输入 verticesByTwo: [
 *      [
 *        [x1, y1, z1],  // 底部点
 *        [x1, y1, z2]   // 顶部点（z2 = z1 + height）
 *      ],
 *      [... 下一对点]
 *    ]
 * 2. 将相邻两对点组合成四边形（墙面段）
 * 3. 每个四边形分解为两个三角形：
 *    Triangle 1: [point2, point1, point4]
 *    Triangle 2: [point1, point3, point4]
 * 4. 计算 UV 坐标：根据水平距离和高度比例设置
 * 5. 应用 alphaMap 实现墙体的渐变透明效果
 *
 * @param verticesByTwo - 墙体路径，每个元素为 [底部点, 顶部点] 数组
 * @param color - 墙体颜色（支持 rgba/hex）
 * @returns THREE.Mesh - 墙体网格对象
 */
const createWallByPath = ({ verticesByTwo = [] as number[][][], color = 0x00ffff as any }): THREE.Mesh => {
  // 将相邻两对点组合成四边形数组
  // verticesByTwo[i] + verticesByTwo[i+1] => 一个四边形墙面段
  const verticesByFour = verticesByTwo.reduce((arr: number[][][][], item, i) => {
    if (i === verticesByTwo.length - 1) return arr; // 跳过最后一元素
    return arr.concat([[item, verticesByTwo[i + 1]!]]); // [当前对, 下一对]
  }, []);

  // 将每个四边形分解为两个三角形，拼接成连续的顶点数组
  // point1, point2 = 第一对（底部、顶部）
  // point3, point4 = 第二对（底部、顶部）
  // Triangle 1: point2, point1, point4
  // Triangle 2: point1, point3, point4
  const verticesByThree = verticesByFour.reduce((arr: number[], item) => {
    const [[point1, point2], [point3, point4]] = item as [[number[], number[]], [number[], number[]]];
    return arr.concat(...point2!, ...point1!, ...point4!, ...point1!, ...point3!, ...point4!);
  }, []);

  // 创建 BufferGeometry 并设置 position 属性
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(verticesByThree);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3)); // 3 个数一组 (x,y,z)

  // 将顶点数组按 18 个一组分组（6 个顶点 * 3 坐标 = 2 个三角形）
  const pointsGroupBy18 = new Array(verticesByThree.length / 3 / 6).fill(0).map((_item, i) => {
    return verticesByThree.slice(i * 3 * 6, (i + 1) * 3 * 6);
  });

  // 将每 18 个数分解为 6 个点，每个点 3 个坐标
  const pointsGroupBy63 = pointsGroupBy18.map((item) => {
    return new Array(item.length / 3).fill(0).map((_it: number, i: number) => item.slice(i * 3, (i + 1) * 3));
  });

  // 计算包围盒，获取 X 轴范围用于 UV 归一化
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const rangeX = max.x - min.x; // 地图 X 轴总宽度

  // 计算 UV 坐标：为每个三角形段设置纹理映射
  // UV 布局：水平方向根据距离缩放，垂直方向 0-1 满铺
  const uvs = ([] as number[]).concat(
    ...pointsGroupBy63.map((item) => {
      const point0 = item[0]; // 第一个三角形的第一个点
      const point5 = item[5]; // 第二个三角形的最后一个点

      // 计算水平距离，除以 rangeX/10 做归一化
      const distance = new THREE.Vector3(...(point0 as [number, number, number])).distanceTo(new THREE.Vector3(...(point5 as [number, number, number]))) / (rangeX / 10);

      // 返回 6 个顶点的 UV 坐标 (u, v)
      // Triangle 1: (0,1), (0,0), (distance,1)
      // Triangle 2: (0,0), (distance,0), (distance,1)
      return [0, 1, 0, 0, distance, 1, 0, 0, distance, 0, distance, 1];
    }),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2)); // 2 个数一组 (u,v)

  // 解析颜色并创建材质
  const tc = tinycolor(color);
  const meshMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide, // 双面渲染
    transparent: true,
    opacity: tc.getAlpha(),
    alphaMap: wallTexture, // 使用纹理的 alpha 通道控制透明度（实现渐变效果）
  });

  return new THREE.Mesh(geometry, meshMat);
};

/**
 * 构建轮廓数据 - 绘制区域边界线和墙体
 *
 * 功能：
 * 1. 边界线：使用 THREE.Line 绘制区域边界
 * 2. 墙体：如果开启 wall.show，生成垂直立体墙面
 *
 * 边界线标记：
 * - line._isGlow = true: 标记为发光对象，在 ThreeMap.ts 中会应用 Bloom 后处理
 *
 * 延迟加载策略：
 * - 边界线立即返回
 * - 墙体通过 drawWall() Promise 延迟创建，避免卡顿
 *
 * @param features - GeoJSON Feature 数组
 * @param options - 系列配置
 * @param config - 地图配置
 * @returns { outline: 边界线对象, drawWall: 延迟创建墙体函数, wallTexture: 纹理引用 }
 */
export const drawOutline = function (
  this: ThreeMapContext,
  features: GeoJsonFeature[],
  options: ThreeMapOptions,
  config: MapConfig,
): { outline: THREE.Object3D; drawWall: () => Promise<THREE.Group>; wallTexture: THREE.Texture } {
  const projection = this.projection; // d3.geoMercator 投影函数

  const wallOption = options.wall;
  const hasWall = wallOption && wallOption.show; // 是否启用墙体
  const { depth, scale } = config;
  const z = (depth + 1) / scale; // Z 轴基准高度（与 drawDistrict 保持一致）
  const outline = new THREE.Object3D(); // 边界线容器

  // 解析边界线颜色
  let outlineColor: string = options.outLineStyle.color;
  const format = tinycolor(outlineColor);
  const opacity = format.getAlpha();
  const rgb = format.toRgb();
  outlineColor = `rgb(${rgb.r},${rgb.g},${rgb.b})`;

  const wallPoints: number[][][][] = []; // 收集墙体路径数据，用于延迟创建

  // 遍历 GeoJSON features
  features.forEach(({ geometry }) => {
    let { coordinates } = geometry;

    // 统一处理为 MultiPolygon 格式
    if (geometry.type === "Polygon") {
      coordinates = [coordinates];
    }

    coordinates.forEach((multiPolygon: any) => {
      multiPolygon.forEach((polygon: number[][]) => {
        // 创建边界线材质
        const lineMaterial = new THREE.LineBasicMaterial({
          color: outlineColor,
          transparent: true,
          opacity,
        });

        const points: THREE.Vector3[] = []; // 线条顶点
        const wp: number[][][] = []; // 墙体路径：[底部点, 顶部点]

        // 遍历多边形顶点，转换坐标
        for (let i = 0; i < polygon.length; i++) {
          const [x, y] = projection(polygon[i] as [number, number]);
          if (x && y) {
            points.push(new THREE.Vector3(x, -y, z)); // 边界线顶点

            // 如果开启墙体，收集底部和顶部点
            if (hasWall) {
              const height = wallOption.height;
              wp.push([
                [x, -y, z], // 底部点
                [x, -y, z + height / scale], // 顶部点（抬高 height）
              ]);
            }
          }
        }
        // 使用顶点创建边界线几何体
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeometry, lineMaterial) as any;

        line.rotation.x = -0.5 * Math.PI; // 旋转到 XZ 平面
        line._isGlow = true; // 标记为发光对象，应用 Bloom 效果

        outline.add(line);
        wallPoints.push(wp); // 收集墙体路径
      });
    });
  });

  // 保存上下文引用，用于延迟创建时检查是否已销毁
  const isClearRef = this;

  /**
   * 延迟创建墙体 - 避免首屏加载卡顿
   *
   * 延迟原因：
   * - 墙体几何体复杂，顶点数量大
   * - UV 计算耗时
   * - 先显示边界线，再异步创建墙体提升体验
   *
   * @returns Promise<THREE.Group> - 包含所有墙体 Mesh 的 Group
   */
  const drawWall = (): Promise<THREE.Group> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const group = new THREE.Group();

        // 检查地图是否已销毁且墙体开启
        if (!isClearRef.isClear && hasWall) {
          const { color } = wallOption;

          // 遍历所有路径，创建墙体
          wallPoints.forEach((points) => {
            const wall = createWallByPath({
              verticesByTwo: points,
              color: color,
            });

            wall.rotation.x = -0.5 * Math.PI; // 旋转到 XZ 平面
            wall.renderOrder = 90; // 渲染顺序（后于大部分对象）
            group.add(wall);
          });

          resolve(group);
        } else {
          resolve(group); // 返回空 Group
        }
      }, 17); // 延迟 1 帧（60fps）
    });
  };

  return { outline, drawWall, wallTexture };
};
