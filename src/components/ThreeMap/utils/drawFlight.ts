import * as THREE from "three";
import { transformRgb } from "./helpers";
import pointTexture from "@/assets/images/point.png";
import type { ThreeMapContext, FlightSeriesOptions, GeoJsonProperties, MapConfig } from "../types";

// 预加载粒子纹理（圆形光晕贴图）
const staticTexture = new THREE.TextureLoader().load(pointTexture);

/**
 * 坐标转换器 - 将代码/坐标转为投影后的屏幕坐标
 *
 * 支持两种输入：
 * 1. adcode 码（字符串/数字）：查找 districtData 中的区域中心点
 * 2. [经度, 纬度] 数组：直接投影
 *
 * @param code - 区域代码 or 经纬度数组
 * @param districtData - 区域属性数组
 * @param projection - d3.geoMercator 投影函数
 * @returns [x, y] 投影后的屏幕坐标 | null | false
 */
const transform = function (code: string | number | number[], districtData: GeoJsonProperties[], projection: (coords: [number, number]) => [number, number]): [number, number] | null | false {
  let x = 0,
    y = 0;

  if (Array.isArray(code)) {
    // 情兵1：直接提供经纬度坐标
    const point = projection(code as [number, number]);
    x = point[0];
    y = point[1];
  } else {
    // 情兵2：提供区域代码，查找对应区域的中心点
    const district = districtData.find((city) => city.adcode == code);
    if (district) {
      const center = (district.centroid || district.center) as [number, number]; // 优先使用 centroid（质心）
      const point = projection(center);
      x = point[0];
      y = point[1];
    } else {
      return false; // 未找到区域
    }
  }

  // 如果 x == y 说明投影失败（通常不会出现）
  if (x == y) return null;
  return [x, y];
};

interface FlightMeshUniforms {
  color: { value: THREE.Color; type: string };
  size: { value: number; type: string };
  u_map: { value: THREE.Texture; type: string };
  u_len: { value: number; type: string };
  u_opacity: { value: number; type: string };
  time: { value: number; type: string };
  isTexture: { value: number; type: string };
}

interface FlightMesh extends THREE.Points {
  _speed: number;
  _repeat: number;
  _been: number;
  _total: number;
  _isHalf: string | null;
}

/**
 * 创建飞行粒子系统 Mesh - 使用自定义 Shader 实现流动粒子动画
 *
 * Shader 原理：
 * 1. Vertex Shader：
 *    - 利用 u_index 属性为每个顶点编号
 *    - 根据 time 和 u_len 计算当前顶点是否在显示窗口内
 *    - 窗口范围：[time, time + u_len]
 *    - 计算 u_scale 使粒子在窗口中渐减大小（头部大，尾部小）
 *
 * 2. Fragment Shader：
 *    - 使用 u_opacitys 控制粒子透明度（头部不透明，尾部透明）
 *    - 应用纹理增加光晕效果
 *
 * @param curvePoints - 贝塞尔曲线上的点数组
 * @param speed - 粒子移动速度
 * @param color - 粒子颜色
 * @param size - 粒子大小
 * @param len - 显示窗口长度（同时显示多少个粒子）
 * @returns FlightMesh - 带自定义属性的粒子系统
 */
const createMesh = function ({ curvePoints, speed, color, size, len }: { curvePoints: THREE.Vector3[]; speed: number; color: string; size: number; len: number }): FlightMesh {
  // 自定义 Shader 代码
  const flightShader = {
    // Vertex Shader：计算顶点位置和粒子大小
    vertexshader: `
        uniform float size;        // 粒子基础大小
        uniform float time;        // 当前动画时间
        uniform float u_len;       // 显示窗口长度
        attribute float u_index;   // 顶点索引（用于判断是否在窗口内）
        varying float u_opacitys;  // 传递给 fragment shader 的透明度
        
        void main() {
            // 判断当前顶点是否在显示窗口内 [time, time+u_len]
            if( u_index < time + u_len && u_index > time){
                // 计算粒子在窗口中的位置比例（0.0 - 1.0）
                float u_scale = 1.0 - (time + u_len - u_index) /u_len;
                u_opacitys = u_scale;  // 传递透明度
                
                // 计算视空间位置
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                // 设置粒子大小：距离越远越小，且根据 u_scale 缩放
                gl_PointSize = size * u_scale * 300.0 / (-mvPosition.z);
            }
        }
        `,
    // Fragment Shader：计算粒子颜色和透明度
    fragmentshader: `
        uniform sampler2D u_map;   // 粒子纹理
        uniform float u_opacity;   // 基础透明度
        uniform vec3 color;        // 粒子颜色
        uniform float isTexture;   // 是否启用纹理
        varying float u_opacitys;  // 从 vertex shader 传入的透明度
        
        void main() {
            // 组合颜色和透明度
            vec4 u_color = vec4(color,u_opacity * u_opacitys);
            
            // 如果启用纹理，与纹理相乘（gl_PointCoord 为粒子的 UV 坐标）
            if( isTexture != 0.0 ){
                gl_FragColor = u_color * texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            }else{
                // 纯色粒子
                gl_FragColor = u_color;
            }
        }`,
  };

  // 创建几何体
  const geometry = new THREE.BufferGeometry();
  const { opacity } = transformRgb(color); // 解析颜色获取透明度
  const threeColor = new THREE.Color(color);

  // 创建 Shader 材质
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: threeColor }, // 粒子颜色
      size: { value: size }, // 粒子大小
      u_map: { value: staticTexture }, // 粒子纹理
      u_len: { value: len }, // 显示窗口长度
      u_opacity: { value: opacity }, // 透明度
      time: { value: -len }, // 初始时间（负值使粒子从起点外开始）
      isTexture: { value: 1.0 }, // 启用纹理
    },
    transparent: true, // 启用透明
    depthTest: false, // 禁用深度测试（粒子始终可见）
    vertexShader: flightShader.vertexshader,
    fragmentShader: flightShader.fragmentshader,
  });

  // 构建 position 和 u_index 属性
  const [position, u_index]: [number[], number[]] = [[], []];
  curvePoints.forEach((it, index) => {
    position.push(it.x, it.y, it.z); // 添加顶点坐标
    u_index.push(index); // 添加顶点索引（用于 shader 中判断）
  });
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("u_index", new THREE.Float32BufferAttribute(u_index, 1)); // 自定义属性

  // 创建 Points 对象（粒子系统）
  // 由于 THREE.Points 类型不包含自定义属性，需要先转为 unknown 再转为 FlightMesh
  const mesh = new THREE.Points(geometry, material) as unknown as FlightMesh;

  // 附加自定义属性，用于动画更新
  mesh._speed = speed; // 移动速度
  mesh._repeat = Infinity; // 无限循环
  mesh._been = 0; // 已经移动的距离（未使用）
  mesh._total = curvePoints.length; // 总点数

  return mesh;
};

/**
 * 绘制飞行线 - 创建贝塞尔曲线飞行动画
 *
 * 实现原理：
 * 1. 根据起点和终点计算中间控制点：
 *    - 水平位置：(start + end) / 2
 *    - 垂直高度：z + 距离 * 0.4 * modelScale（距离越远抱物线越高）
 * 2. 使用 THREE.QuadraticBezierCurve3 生成二次贝塞尔曲线
 * 3. 将曲线离散化为 points*2 个点
 * 4. 创建两个粒子系统：
 *    - mesh：主粒子系统
 *    - halfMesh：副粒子系统（初始隐藏，用于实现循环动画的平滑过渡）
 *
 * @param options - 飞行线配置
 * @param config - 地图配置
 * @returns THREE.Group - 包含所有飞行线粒子系统的组
 */
export const drawFlight = function (this: ThreeMapContext, options: FlightSeriesOptions, config: MapConfig): THREE.Group {
  const projection = this.projection;
  const modelScale = this.scale; // 地图缩放比例
  const data = options.data || [];
  const group = new THREE.Group() as any;
  const { depth, scale } = config;
  const z = (depth + 1) / scale; // 飞行线的基准高度

  const { flightColor, headSize, points, speed = 10 } = options;
  const size = (1 * headSize) / scale; // 粒子大小

  data.forEach((it) => {
    // 转换起点和终点坐标
    const start = transform(it.start, this.districtData, projection);
    const end = transform(it.end, this.districtData, projection);

    if (start && end) {
      const [sx, sy] = start;
      const [ex, ey] = end;

      // 创建起点和终点的 Vector3
      const startPoint = new THREE.Vector3(sx, z, sy);
      const endPoint = new THREE.Vector3(ex, z, ey);

      // 计算中间控制点
      const middle = new THREE.Vector3(0, 0, 0);
      middle.add(startPoint).add(endPoint).divideScalar(2); // 中点 = (起点 + 终点) / 2

      const L = startPoint.clone().sub(endPoint).length(); // 起终点距离
      middle.y = z + L * 0.4 * modelScale; // 抬高控制点，形成抛物线

      // 使用二次贝塞尔曲线连接三个点
      const curve = new THREE.QuadraticBezierCurve3(startPoint, middle, endPoint);
      const curvePoints = curve.getPoints(points * 2); // 离散化曲线

      const color = flightColor[0]!;
      const len = curvePoints.length;

      // 创建主粒子系统
      const mesh = createMesh({ curvePoints, speed, color, size, len });

      // 创建副粒子系统（用于循环动画）
      const halfMesh = createMesh({ curvePoints, speed, color, size, len });
      halfMesh._isHalf = mesh.uuid; // 关联到主系统

      group.add(mesh);
      group.add(halfMesh);
    }
  });

  group._category = "flight"; // 标记类型
  return group;
};

/**
 * 更新飞行线动画 - 每帧调用
 *
 * 动画逻辑：
 * 1. 主系统（_isHalf = null）：
 *    - time 从 -len 开始递增，粒子从起点开始显示
 *    - time 达到 0 时，激活副系统（设置 _isHalf = null）
 *    - time 达到 _total 时，重置到 -len，开始下一轮
 *
 * 2. 副系统（_isHalf = mesh.uuid）：
 *    - 初始隐藏，return false 跳过更新
 *    - 当主系统 time >= 0 时被激活，_isHalf 设为 null
 *    - 激活后与主系统同步更新
 *
 * 这样设计可实现无缝循环：副系统在主系统到达中点时进入，主系统重置时副系统继续播放
 *
 * @param group - 飞行线粒子系统数组
 */
export const updateMiniFly = function (group: FlightMesh[]): void {
  group.forEach((mesh) => {
    // Material 可能是数组或 ShaderMaterial，需要类型守卫
    // 由于我们创建时明确使用了 ShaderMaterial，这里直接断言
    const material = mesh.material as THREE.ShaderMaterial;
    const uniforms = material.uniforms as any;

    // 当主系统 time 达到 0 时，激活对应的副系统
    if (uniforms.time.value >= 0 && !mesh._isHalf) {
      const halfMesh = group.find((it) => it._isHalf === mesh.uuid);
      if (halfMesh) halfMesh._isHalf = null; // 取消 _isHalf 标记，启用副系统
    }

    // 跳过未激活的副系统
    if (mesh._isHalf) return false;

    // 更新动画时间
    if (uniforms.time.value < mesh._total) {
      uniforms.time.value += mesh._speed * 0.5; // 每帧递增
    } else {
      // 到达终点，重置到起点
      uniforms.time.value = -uniforms.u_len.value;
    }
  });
};
