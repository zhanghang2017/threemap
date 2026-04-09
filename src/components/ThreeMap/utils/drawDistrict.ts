import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import tinycolor from "tinycolor2";
import { drawLabel } from "./drawLabel";
import { isNumber, rangeColor, separateColor, centerOfMass, deepMerge } from "./helpers";
import chinaTexture from "@/assets/images/china_tintable_hc.png";
import type { ThreeMapContext, ThreeMapOptions, GeoJsonFeature, GeoJsonProperties, MapConfig, DataItem, LabelOptions, MapUniform } from "../types";

// 预加载中性灰度纹理，避免颜色混合污染
const staticTexture = new THREE.TextureLoader().load(chinaTexture);

/**
 * 生成 Fragment Shader 代码片段 - 实现侧面扫光动画效果
 *
 * 核心逻辑：
 * 1. 垂直渐变：底部黑色 -> 顶部浅蓝色，模拟环境光照
 * 2. 扫光动画：y 坐标随时间移动，在 [y, y+h] 区间内与 uColor 混合
 * 3. 平滑过渡：使用 per 比例值实现颜色从 outgoingLight -> uColor -> outgoingLight 的渐变
 *
 * @param depth - 区域拉伸深度，用于归一化 z 坐标范围
 * @returns GLSL 代码字符串，插入到 fragmentShader 中替换默认光照计算
 */
const outputFragment = function (depth: number): string {
  return `
  // 获取基础间接漫反射光照
  vec3 outgoingLight = reflectedLight.indirectDiffuse;
  
  // 垂直渐变：根据 z 高度在黑色和浅蓝色之间插值，模拟天空光
  vec3 gradient = mix(vec3(0,0,0),vec3(0.9,0.9,1.0), vPosition.z/${depth}.0);
  outgoingLight = outgoingLight*gradient;
  
  // 计算扫光带的当前位置 y = 起始位置 + 时间 * 速度
  float y = uStart + uTime * uSpeed;
  float h = uHeight / 1.0; // 扫光带高度
  
  // 如果顶点在扫光带范围内 [y, y+h]，则与高亮颜色混合
  if(vPosition.z > y && vPosition.z < y + h * 1.0) {
      float per = 0.0; // 混合比例
      if(vPosition.z < y + h){
          // 上升阶段：从原始颜色渐变到高亮色
          per = (vPosition.z - y) / h;
          outgoingLight = mix(outgoingLight,uColor,per);
      }else{
          // 下降阶段：从高亮色渐变回原始颜色
          per = (vPosition.z - y - h) / h;
          outgoingLight = mix(uColor,outgoingLight,per);
      }
  }
  
  // 输出最终颜色（保持原始 alpha 通道）
  diffuseColor = vec4( outgoingLight, diffuseColor.a );
  `;
};

interface ShapeDataItem {
  shape: THREE.Shape;
  extrudeSettings: THREE.ExtrudeGeometryOptions;
  material: THREE.MeshBasicMaterial;
  materialSide: THREE.MeshBasicMaterial;
  _privateData: any;
  label: CSS2DObject | null;
  scale: number;
}

/**
 * 辅助函数：批量构建拉伸几何体（ExtrudeGeometry）
 *
 * 工作流程：
 * 1. 遍历 shapeData 数组中的每个区域数据
 * 2. 使用 THREE.ExtrudeGeometry 将 2D Shape 拉伸成 3D 几何体
 * 3. 创建 Mesh 并应用双材质 [顶面材质, 侧面材质]
 * 4. 应用旋转和缩放变换使几何体正确显示在地图上
 * 5. 附加自定义数据和标签引用
 *
 * @param shapeData - 包含 Shape、拉伸设置、材质、私有数据的数组
 * @returns THREE.Group - 包含所有区域 Mesh 的组
 */
const drawShapeAssist = function (shapeData: ShapeDataItem[]): THREE.Group {
  const group = new THREE.Group();
  shapeData.forEach((item) => {
    const { shape, extrudeSettings, material, materialSide, _privateData, label, scale } = item;

    // ExtrudeGeometry 将 2D Shape 沿 Z 轴拉伸，生成带厚度的 3D 几何体
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 双材质数组：[0] 用于顶面和底面，[1] 用于侧面
    const district = new THREE.Mesh(geometry, [material, materialSide]) as any;

    // 标记类型方便后续 raycaster 拾取判断
    district._type = "district";
    district._privateData = _privateData; // 存储区域属性、颜色、高亮配置等

    // 绕 X 轴旋转 -90度，将 XY 平面转为 XZ 平面（Three.js 默认 Y 轴向上）
    district.rotation.x = -0.5 * Math.PI;

    // Z 轴缩放 2/scale，调整拉伸高度以匹配地图比例
    district.scale.set(1, 1, 2 / scale);

    // 关联 CSS2D 标签的 DOM 元素，用于高亮时访问
    label && (district._label = label.element);

    group.add(district);
  });
  return group;
};

/**
 * 创建侧面材质 - 应用扫光动画 Shader
 *
 * Shader 注入原理：
 * 1. 使用 onBeforeCompile 钩子在编译前修改 Three.js 内置 shader
 * 2. 在 vertexShader 中传递 vPosition 到 fragmentShader
 * 3. 在 fragmentShader 中注入自定义 uniform 变量和扫光逻辑
 * 4. 替换默认光照计算为 outputFragment 生成的扫光代码
 *
 * Uniform 变量说明：
 * - uTime: 动画时间（0-2 循环），每帧累加 deltaTime
 * - uHeight: 扫光带高度（depth/2）
 * - uColor: 扫光高亮颜色（科技蓝）
 * - uStart: 扫光起始位置（-depth/2，从底部开始）
 * - uSpeed: 扫光移动速度（depth/4，深度越大速度越快）
 *
 * @param color - 侧面基础颜色
 * @param uColor - 扫光高亮颜色
 * @param config - 地图配置（包含 depth）
 * @returns { mapUf: Uniform 对象引用, materialSide: 编译后的材质 }
 */
const createSideMaterial = function (color: string, uColor: string, config: MapConfig): { mapUf: MapUniform; materialSide: THREE.MeshBasicMaterial } {
  const { depth } = config;

  // 创建 Uniform 变量对象，动画循环时会修改 uTime.value
  const mapUf: MapUniform = {
    uTime: { value: 0.0 }, // 当前动画时间
    uHeight: { value: depth / 2 }, // 扫光带高度
    uColor: { value: new THREE.Color(uColor) }, // 高亮颜色（RGB）
    uStart: { value: -depth / 2 }, // 起始 Z 坐标（底部）
    uSpeed: { value: Math.ceil(depth / 4) }, // 移动速度
  };

  // 解析颜色字符串获取 RGB 和 Alpha
  const format = tinycolor(color);
  const { r, g, b } = format.toRgb();

  // 创建基础材质（MeshBasicMaterial 无光照计算，性能更好）
  const materialSide = new THREE.MeshBasicMaterial({
    color: `rgb(${r},${g},${b})`,
    transparent: true,
    opacity: format.getAlpha(),
  });

  // onBeforeCompile: 在 shader 编译前注入自定义代码
  materialSide.onBeforeCompile = (shader) => {
    // 将自定义 uniform 合并到 shader.uniforms
    shader.uniforms = {
      ...shader.uniforms,
      ...mapUf,
    };

    // 修改 Vertex Shader：声明 varying 变量传递顶点位置到 Fragment Shader
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `
          varying vec3 vPosition; // 将 position 传递给 fragment shader
          void main() {
            vPosition = position; // 赋值顶点局部坐标
        `,
    );

    // 修改 Fragment Shader：声明 varying 和 uniform 变量
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `
          varying vec3 vPosition;  // 接收 vertex shader 传来的位置
          uniform float uTime;     // 动画时间
          uniform vec3 uColor;     // 高亮颜色
          uniform float uSpeed;    // 扫光速度
          uniform float uStart;    // 起始位置
          uniform float uHeight;   // 扫光带高度
          void main() {
        `,
    );

    // 替换默认光照计算为扫光动画逻辑
    const d = parseInt(String(config.depth / 2));
    shader.fragmentShader = shader.fragmentShader.replace("vec3 outgoingLight = reflectedLight.indirectDiffuse;", outputFragment(d));
  };

  return { mapUf, materialSide };
};

interface DrawDistrictResult {
  mapUf: MapUniform;
  meshGroup: THREE.Group;
  advanceMeshGroup: THREE.Group;
  districtData: GeoJsonProperties[];
  _realShape: () => Promise<THREE.Group>;
  _cancelRealShape: () => void;
  mapTexture: THREE.Texture | null;
}

/**
 * 构建区域数据 - 核心渲染函数
 *
 * 工作流程：
 * 1. 数据准备：解析颜色范围、映射 data 到 district，计算分段/渐变色阶
 * 2. GeoJSON 遍历：处理 Polygon 和 MultiPolygon 几何类型
 * 3. 坐标投影：将经纬度坐标通过 d3.geoMercator 转为屏幕坐标
 * 4. Shape 构建：使用 THREE.Shape 构造 2D 轮廓（moveTo/lineTo）
 * 5. 几何生成：
 *    - ShapeGeometry: 快速平面几何（低精度预览）
 *    - ExtrudeGeometry: 延迟创建的拉伸几何（高精度渲染）
 * 6. 材质应用：顶面材质、侧面扫光材质
 * 7. 纹理映射：计算 BoundingBox，UV 比例缩放，应用中性灰度纹理
 *
 * 返回值说明：
 * - meshGroup: 包含边界线和标签的组合
 * - advanceMeshGroup: 包含平面 ShapeGeometry Mesh 的组合（用于快速预览）
 * - districtData: 所有区域属性数组
 * - _realShape: 延迟创建函数，返回 ExtrudeGeometry 的 Promise
 * - mapTexture: 纹理对象引用
 * - mapUf: Uniform 对象，用于扫光动画控制
 *
 * @param data - 用户数据数组（district, value, color）
 * @param options - 系列配置（itemStyle, emphasis, label 等）
 * @param features - GeoJSON Feature 数组
 * @param config - 地图全局配置（depth, scale）
 */
export const drawDistrict = function (this: ThreeMapContext, data: DataItem[], options: ThreeMapOptions, features: GeoJsonFeature[], config: MapConfig): DrawDistrictResult {
  const projection = this.projection; // d3.geoMercator 投影函数
  const itemStyle = options.itemStyle;
  const emphasis = options.emphasis;
  const seriesName = options.seriesName;
  const range = itemStyle.range;

  // 色阶参数解析：如果开启 range.show，根据 value 计算颜色
  let sc: string | null = null; // startColor
  let ec: string | null = null; // endColor
  let min = Number.MIN_SAFE_INTEGER;
  let max = Number.MAX_SAFE_INTEGER;
  if (range.show) {
    sc = range.color[0]!;
    ec = range.color[1]!;
    min = range.min;
    max = range.max;
  }

  // 构建 district -> DataItem 的映射表，并计算每个区域的显示颜色
  const dataMap = new Map<string, DataItem>();
  data.forEach((it) => {
    if (sc != null && ec != null) {
      const value = it.value;
      let color: string;
      // 分段色阶 vs 渐变色阶
      if (range.mode === "separate") {
        // 分段：根据 rules 匹配颜色
        color = separateColor(value!, range.rules, ec);
      } else {
        // 渐变：在 [min, max] 范围内线性插值
        color = rangeColor(sc, ec, min, max, value);
      }
      it.color = color;
    } else {
      it.color = null; // 使用默认颜色
    }
    dataMap.set(it.district + "", it);
  });

  const lineStyle = options.lineStyle;
  const topColor = itemStyle.topColor; // 顶面颜色
  const sideColor = itemStyle.sideColor; // 侧面基色
  const uColor = itemStyle.uColor; // 扫光高亮色

  // 解析边界线颜色
  const lineColor = lineStyle.color;
  const lineFormat = tinycolor(lineColor);
  const lineRgb = lineFormat.toRgb();
  const lineOpacity = lineFormat.getAlpha();
  const _lineColor = `rgb(${lineRgb.r},${lineRgb.g},${lineRgb.b})`;

  // 创建侧面扫光材质，返回 Uniform 引用和材质对象
  const { mapUf, materialSide } = createSideMaterial(sideColor, uColor, config);
  let mapTexture: THREE.Texture | null = null;

  const meshGroup = new THREE.Group(); // 快速组：线框 + 标签
  const advanceMeshGroup = new THREE.Group(); // 预览组：ShapeGeometry 平面体

  const { depth, scale } = config;
  const z = (depth + 1) / scale; // Z 轴基准高度
  const districtData: GeoJsonProperties[] = []; // 收集所有区域属性
  const shapeData: ShapeDataItem[] = []; // 收集 ExtrudeGeometry 所需数据

  // 遍历 GeoJSON features，每个 feature 代表一个省/市/区
  features.forEach((feature) => {
    let { geometry, properties } = feature;

    districtData.push(properties); // 收集所有区域属性
    properties.seriesName = seriesName;
    const item = dataMap.get(properties.adcode + ""); // 匹配用户数据

    let { coordinates } = geometry;

    // 合并 properties 和用户 data，用户数据优先级更高
    properties = deepMerge({} as any, properties, item || {});

    // 绘制区域名称标签（CSS2DObject）
    const label = drawDistrictName.call(this, item ? item : undefined, options.label, properties, feature, options.config);
    label && meshGroup.add(label);

    // 处理 Polygon 和 MultiPolygon 两种几何类型
    // Polygon: [[x,y],[x,y],...]
    // MultiPolygon: [[[x,y],[x,y],...], [[x,y],[x,y],...]]
    if (geometry.type === "Polygon") {
      coordinates = [coordinates]; // 统一转为 MultiPolygon 格式
    }

    coordinates.forEach((multiPolygon: any) => {
      multiPolygon.forEach((polygon: number[][]) => {
        const shape = new THREE.Shape(); // 创建 2D 轮廓 Shape

        // 创建边界线材质
        const lineMaterial = new THREE.LineBasicMaterial({
          color: _lineColor,
          transparent: true,
          opacity: lineOpacity,
        });

        const points: THREE.Vector3[] = []; // 用于 LineGeometry

        // 遍历多边形的每个顶点
        for (let i = 0; i < polygon.length; i++) {
          // 将经纬度 [lng, lat] 投影到屏幕坐标 [x, y]
          const [x, y] = projection(polygon[i] as [number, number]);

          // 第一个点使用 moveTo，后续点使用 lineTo 连接成闭合图形
          if (i === 0) {
            shape.moveTo(x, -y); // Y 轴反转（地理坐标系 -> Three.js 坐标系）
          }
          if (x && y) {
            shape.lineTo(x, -y); // 构建 Shape 路径
            points.push(new THREE.Vector3(x, -y, z)); // 构建边界线顶点
          }
        }

        // 使用顶点数组创建线条几何体
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

        // ExtrudeGeometry 拉伸设置：深度 + 斜角参数
        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
          depth: depth / 2, // 拉伸深度（为 depth 的一半，后续缩放 2x）
          bevelEnabled: true, // 启用斜角
          bevelSegments: 10, // 斜角分段数，增加圆滑度
          bevelThickness: 0.1, // 斜角厚度
        };

        // 决定顶面颜色：用户 data 中的 color > 默认 topColor
        const color = item && item.color ? item.color : topColor;
        const polygonFormat = tinycolor(color);
        const { r, g, b } = polygonFormat.toRgb();

        // 创建顶面/底面材质（MeshBasicMaterial 无光照）
        const material = new THREE.MeshBasicMaterial({
          color: `rgb(${r},${g},${b})`,
          transparent: true,
          opacity: polygonFormat.getAlpha(),
        });

        // 构建私有数据对象，存储于 Mesh._privateData 用于交互
        const _privateData: any = {
          ...properties,
          deriveColor: color, // 计算后的颜色
          textStyle: options.label.itemStyle.textStyle, // 标签样式
        };

        // 如果启用 emphasis （鼠标悬停高亮），存储高亮配置
        if (emphasis.show) {
          _privateData["emphasisColor"] = emphasis.topColor; // hover 时的颜色
          _privateData["emphasisText"] = emphasis.textStyle; // hover 时的文字样式
        } else {
          Reflect.deleteProperty(_privateData, "emphasisColor");
          Reflect.deleteProperty(_privateData, "emphasisText");
        }

        // 将数据收集到 shapeData，用于延迟创建 ExtrudeGeometry
        shapeData.push({
          shape,
          extrudeSettings,
          material,
          materialSide,
          label: label || null,
          scale,
          _privateData,
        });

        // 创建快速预览版本：ShapeGeometry 平面体（不带厚度）
        const shapeGeo = new THREE.ShapeGeometry(shape);
        const district = new THREE.Mesh(shapeGeo, material) as any;
        district._type = "shape_district"; // 标记为平面版本
        district._privateData = _privateData;

        // 旋转到 XZ 平面并抬高到区域拉伸的顶部
        district.rotation.x = -0.5 * Math.PI;
        district.position.y = depth / scale; // 抬高到顶部

        label && (district._label = label.element);
        advanceMeshGroup.add(district); // 加入预览组

        // 创建边界线 Mesh
        const line = new THREE.Line(lineGeometry, lineMaterial) as any;
        line.rotation.x = -0.5 * Math.PI;
        line._type = "districtLine";
        lineOpacity > 0 && meshGroup.add(line); // 只在不透明时添加
      });
    });
  });

  // ==================== 纹理映射：计算 UV 缩放并应用纹理 ====================
  if (options.texture && options.texture.show) {
    // 计算 advanceMeshGroup 的包围盒，获取整个地图的边界
    const box = new THREE.Box3().setFromObject(advanceMeshGroup);
    const boxMin = box.min;
    const boxMax = box.max;

    // 计算 UV 缩放比例：1 / 地图宽度，1 / 地图高度
    // 这样纹理会铺满整个地图区域
    const uvScale = new THREE.Vector2(1 / (boxMax.x - boxMin.x), 1 / (boxMax.z - boxMin.z));

    // 缓存 uvScale 到上下文，避免切换地图时重复计筗
    if (this.refresh) {
      this.uvScale = uvScale;
    }

    if (!mapTexture) {
      let scaleX = 1;
      let scaleY = 1;
      const { repeat, autoRepeat, offset } = options.texture;

      // 加载纹理图片：自定义图片 or 默认灰度纹理
      if (options.texture.image !== "default") {
        const image = options.texture.image;
        const texture = new THREE.TextureLoader().load(image);
        mapTexture = texture;
      } else {
        mapTexture = staticTexture; // 使用预加载的 china_tintable_hc.png
      }

      // 自动重复 vs 手动设置重复次数
      if (autoRepeat) {
        const { x, y } = repeat;
        scaleX = x;
        scaleY = y;
      } else {
        // 使用计算的 UV 缩放，纹理铺满整个地图
        scaleX = this.uvScale!.x;
        scaleY = this.uvScale!.y;
      }

      // 纹理配置：
      mapTexture.flipY = true; // Y 轴翻转（匹配地理坐标系）
      mapTexture.wrapS = THREE.RepeatWrapping; // 水平重复
      mapTexture.wrapT = THREE.RepeatWrapping; // 垂直重复
      mapTexture.repeat.set(scaleX, scaleY); // 设置重复次数
      mapTexture.offset.set(offset.x, offset.y); // 偏移量
    }

    // 将纹理应用到所有区域 Mesh 的 material.map
    advanceMeshGroup.children.forEach((district: any) => {
      district.material.map = mapTexture;
      district.material.needsUpdate = true; // 通知 Three.js 重新编译 shader
    });
  }

  // isClearRef 用于检查地图是否已被销毁，避免延迟创建时执行已销毁的操作
  const isClearRef = this;

  /**
   * 延迟创建 ExtrudeGeometry - 避免卡顿，提升首屏渲染速度
   *
   * 延迟策略：
   * - 立即显示 ShapeGeometry（平面版，性能高）
   * - 17ms 后异步创建 ExtrudeGeometry（拉伸版，计算量大）
   * - ThreeMap.ts 中会调用该函数，用 ExtrudeGeometry 替换 ShapeGeometry
   *
   * @returns Promise<THREE.Group> - 包含所有 ExtrudeGeometry Mesh 的 Group
   */
  let _realShapeTimerId: ReturnType<typeof setTimeout> | null = null;

  const _realShape = (): Promise<THREE.Group> => {
    return new Promise((resolve) => {
      // setTimeout 17ms 约等于 1 帧（60fps），让浏览器先渲染平面版
      _realShapeTimerId = setTimeout(() => {
        _realShapeTimerId = null;
        if (!isClearRef.isClear) {
          // 调用 drawShapeAssist 批量构建 ExtrudeGeometry
          const group = drawShapeAssist(shapeData);
          resolve(group);
        } else {
          // 已销毁，返回空 Group
          resolve(new THREE.Group());
        }
      }, 17);
    });
  };

  const _cancelRealShape = (): void => {
    if (_realShapeTimerId !== null) {
      clearTimeout(_realShapeTimerId);
      _realShapeTimerId = null;
    }
  };

  return { mapUf, meshGroup, advanceMeshGroup, districtData, _realShape, _cancelRealShape, mapTexture };
};

/**
 * 侧边动画
 */
export const districtAnimate = function (this: ThreeMapContext, mapUf: MapUniform | undefined): boolean | void {
  if (!mapUf) return false;
  const deltaTime = this.clock.getDelta();
  mapUf.uTime.value += deltaTime;
  if (mapUf.uTime.value >= 2) {
    mapUf.uTime.value = 0.0;
  }
};

/**
 * 区域渲染（hover效果）
 */
export const districtRender = function (this: ThreeMapContext): void {
  const { raycaster, scene } = this;

  if (this.pickDistrictMesh) {
    const mesh = this.pickDistrictMesh.object as any;
    mesh.material[0].opacity = mesh.material[0]._opacity;
    if (mesh._type === "district") {
      const { deriveColor, textStyle } = mesh._privateData;
      const polygonFormat = tinycolor(deriveColor);
      const { r, g, b } = polygonFormat.toRgb();
      mesh.material[0].color.set(`rgb(${r},${g},${b})`);

      if (mesh._label) {
        const ele = mesh._label as HTMLElement;
        Object.keys(textStyle).forEach((key: string) => {
          if (isNumber(textStyle[key])) {
            (ele.style as any)[key] = textStyle[key] + "px";
          } else if (Array.isArray(textStyle[key])) {
            (ele.style as any)[key] = textStyle[key].join("px ") + "px";
          } else {
            (ele.style as any)[key] = textStyle[key];
          }
        });
      }
    }
  }
  this.pickDistrictMesh = null;
  const intersects = raycaster.intersectObjects(scene.children, true);
  const r = intersects.filter((it: any) => it.object._type === "district" || it.object._type === "scatter");

  if (r.length && (r[0]!.object as any)._type === "district") {
    this.pickDistrictMesh = r[0]!;
    const mesh = this.pickDistrictMesh.object as any;
    mesh.material[0]._opacity = mesh.material[0].opacity;

    const { emphasisColor, emphasisText } = mesh._privateData;
    emphasisColor && mesh.material[0].color.set(emphasisColor);
    if (emphasisText && mesh._label) {
      const ele = mesh._label as HTMLElement;
      Object.keys(emphasisText).forEach((key: string) => {
        if (isNumber(emphasisText[key])) {
          (ele.style as any)[key] = emphasisText[key] + "px";
        } else if (Array.isArray(emphasisText[key])) {
          (ele.style as any)[key] = emphasisText[key].join("px ") + "px";
        } else {
          (ele.style as any)[key] = emphasisText[key];
        }
      });
    }
  }
};

/**
 * 绘制区域名称
 */
function drawDistrictName(
  this: ThreeMapContext,
  data: DataItem | undefined,
  options: LabelOptions,
  properties: GeoJsonProperties,
  feature: GeoJsonFeature,
  config: MapConfig,
): CSS2DObject | undefined {
  const projection = this.projection;
  let center = properties.centroid || properties.center;

  if (options.show) {
    if (!Array.isArray(center)) {
      center = centerOfMass(feature).geometry.coordinates;
    }
    const [x, y] = projection(center as [number, number]);
    const label = drawLabel(options, { ...properties, ...data });

    let now = new Date().getTime();
    let isDbl = false;
    label.addEventListener("pointerdown", (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const clickTime = new Date().getTime();
      if (clickTime - now < 300) {
        isDbl = true;
        if (this.events["dblclick"]) {
          this.events["dblclick"].forEach((cb) => {
            cb(properties);
          });
        }
      } else {
        setTimeout(() => {
          if (!isDbl && this.events["click"]) {
            this.events["click"].forEach((cb) => {
              cb(properties);
            });
          }
          isDbl = false;
        }, 300);
      }
      now = clickTime;
    });

    const name = new CSS2DObject(label) as any;
    const { depth, scale } = config;
    const z = (depth + 1) / scale;
    name.position.set(x, z, y);
    name._type = "label";
    name._isDistrict = true;
    return name;
  }
}
