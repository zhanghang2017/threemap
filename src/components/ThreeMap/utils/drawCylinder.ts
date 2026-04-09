import * as THREE from "three";
import { drawLabel } from "./drawLabel";
import light from "@/assets/images/default_light.png";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { ThreeMapContext, CylinderSeriesOptions, MapConfig } from "../types";

// 模块级别加载纹理，避免每次 setOption() 创建新纹理实例导致内存泄漏
const towerTexture = new THREE.TextureLoader().load(light);

/**
 * 创建圆柱材质 - 应用垂直渐变色 Shader
 *
 * Shader 原理:
 * 1. Vertex Shader: 传递 UV 坐标到 Fragment Shader
 * 2. Fragment Shader: 根据 vUv.y (垂直位置) 在 color1 和 color2 之间插值
 *    - vUv.y = 0: 底部，使用 color1
 *    - vUv.y = 1: 顶部，使用 color2
 *    - 0 < vUv.y < 1: 线性渐变
 * 3. 最终透明度固定为 0.9
 *
 * @param color1 - 底部颜色（深色）
 * @param color2 - 顶部颜色（浅色）
 * @returns THREE.MeshBasicMaterial - 带渐变 Shader 的材质
 */
const createCylinderMaterial = function (color1: string, color2: string): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
  });

  // 使用 onBeforeCompile 注入自定义 Shader
  material.onBeforeCompile = (shader) => {
    // 注入 uniform 变量
    shader.uniforms = {
      ...shader.uniforms,
      color1: { value: new THREE.Color(color1) }, // 底部颜色
      color2: { value: new THREE.Color(color2) }, // 顶部颜色
    };

    // 修改 Vertex Shader: 传递 UV 坐标
    shader.vertexShader = shader.vertexShader.replace(
      `void main() {`,
      `
        varying vec2 vUv;  // 传递给 fragment shader
        void main() {
            vUv = uv;      // 赋值 UV 坐标
        `,
    );

    // 修改 Fragment Shader: 声明 uniform 和 varying
    shader.fragmentShader = shader.fragmentShader.replace(
      `void main() {`,
      `
        varying vec2 vUv;      // 接收 vertex shader 传来的 UV
        uniform vec3 color1;   // 底部颜色
        uniform vec3 color2;   // 顶部颜色
        void main() {
        `,
    );

    // 替换最终输出: 根据 vUv.y 插值颜色
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <dithering_fragment>`,
      `
        // 垂直渐变: vUv.y 从 0(底) 到 1(顶)
        vec3 color = mix(color1, color2, vUv.y);
        gl_FragColor = vec4(color,0.9);  // 输出颜色 + 透明度
        #include <dithering_fragment>
        `,
    );
  };
  return material;
};

/**
 * 绘制圆柱 - 创建 3D 圆柱或尖塔
 *
 * 两种模式:
 * 1. cylinder (圆柱):
 *    - 使用 CylinderGeometry 创建真正的3D圆柱体
 *    - 应用垂直渐变材质 (color[0] -> color[1])
 *    - 适用于柱状图、数据可视化
 *
 * 2. tower (尖塔):
 *    - 使用两个相互垂直的 PlaneGeometry 组成十字形
 *    - 应用发光纹理和 towerColor
 *    - 双面渲染 + depthWrite=false 实现半透明效果
 *    - 适用于地标标记、光柱效果
 *
 * 高度计算:
 * - h = (value * maxHeight) / maxValue  // 按比例缩放
 * - 应用 minHeight 限制保证可见性
 * - 最终除以 scale 适应地图缩放
 *
 * @param options - Cylinder 系列配置
 * @param config - 地图配置
 * @returns THREE.Group - 包含所有圆柱/尖塔的组
 */
export const drawCylinder = function (this: ThreeMapContext, options: CylinderSeriesOptions, config: MapConfig): THREE.Group {
  const projection = this.projection;
  const seriesName = options.seriesName;
  const modelScale = this.scale;
  let data = options.data || [];
  const cylinderGroup = new THREE.Group() as any;
  let maxValue = 0;

  data = data.filter((it) => it.value != undefined && it.value != null);
  data.forEach((it) => {
    maxValue = Math.max(maxValue, it.value!);
    maxValue = isNaN(maxValue) ? 1 : maxValue;
  });

  const { depth, scale } = config;
  const z = (depth + 1) / scale; // Z 轴基准高度
  const { mode, size, maxHeight, minHeight, towerColor, color, separate, label, offset } = options;

  // 如果是 tower 模式,预加载发光纹理
  let texture: THREE.Texture | null = null;
  if (mode === "tower") {
    texture = towerTexture;
  }

  data.forEach((it) => {
    let x = 0,
      y = 0;
    if (Array.isArray(it.district)) {
      const point = projection(it.district as [number, number]);
      x = point[0];
      y = point[1];
    } else {
      const district = this.districtData.find((city) => city.adcode == it.district);
      if (district) {
        const center = (district.centroid || district.center) as [number, number];
        const point = projection(center);
        it = { ...district, ...it };
        x = point[0];
        y = point[1];
      } else {
        return false;
      }
    }

    // 计算圆柱高度
    let h = (it.value! * maxHeight) / maxValue; // 按比例缩放
    h = h < minHeight ? minHeight : h; // 应用最小高度
    h = h / scale; // 根据地图缩放调整

    // 创建标签 (CSS2DObject)
    let labelMesh: CSS2DObject | null = null;
    if (label.show) {
      const labelDom = drawLabel(label, it);
      labelMesh = new CSS2DObject(labelDom) as any;
      (labelMesh as any)._type = "label";

      // 计算标签位置: 默认在圆柱顶部 + offset
      const labelOffset = label.offset || [0, 20];
      const lOffsetX = labelOffset[0] / scale;
      const lOffsetY = labelOffset[1] / scale;
      labelMesh!.position.x = labelMesh!.position.x + lOffsetX;
      labelMesh!.position.y = labelMesh!.position.y + lOffsetY + h / 2; // 在圆柱中点上方

      // 绑定点击/双击事件
      let now = new Date().getTime();
      let isDbl = false;
      labelDom.addEventListener("pointerdown", (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const clickTime = new Date().getTime();
        if (clickTime - now < 300) {
          isDbl = true;
          if (this.events["dblclick"]) {
            this.events["dblclick"].forEach((cb) => {
              cb({ ...it, seriesName });
            });
          }
        } else {
          setTimeout(() => {
            if (!isDbl && this.events["click"]) {
              this.events["click"].forEach((cb) => {
                cb({ ...it, seriesName });
              });
            }
            isDbl = false;
          }, 300);
        }
        now = clickTime;
      });
    }

    // 模式 1: 圆柱 (CylinderGeometry)
    if (mode === "cylinder") {
      // CylinderGeometry(顶部半径, 底部半径, 高度, 分段数)
      const geometry = new THREE.CylinderGeometry(size / (scale * 5), size / (scale * 5), h, separate);
      const mesh = new THREE.Mesh(geometry, createCylinderMaterial(color[0], color[1])) as any;

      // 应用偏移量
      let [oX, oY] = offset;
      oX = oX / scale;
      oY = oY / scale;

      mesh._privateData = it;
      mesh._type = "cylinder";

      // 设置位置: y = h/2 + z (使底部对齐地面)
      mesh.position.set(x + oX, h / 2 + z, y + oY);

      // X 轴缩放 1/modelScale 保持相对大小，Y 轴不缩放保持高度
      mesh.scale.set(1 / modelScale, 1, 1 / modelScale);

      labelMesh && mesh.add(labelMesh); // 附加标签
      cylinderGroup.add(mesh);
    }
    // 模式 2: 尖塔 (PlaneGeometry 十字交叉)
    else if (mode === "tower") {
      // 创建平面几何体作为光柱
      const lightGeometry = new THREE.PlaneGeometry(size / scale, h);
      const meshBasicMaterial = new THREE.MeshBasicMaterial({
        color: towerColor,
        map: texture, // 应用发光纹理
        transparent: true,
        side: THREE.DoubleSide, // 双面渲染
        depthWrite: false, // 禁用深度写入，实现透明叠加效果
      });

      const mesh = new THREE.Mesh(lightGeometry, meshBasicMaterial) as any;
      mesh._privateData = it;
      mesh._type = "cylinder";

      // 设置位置在圆柱中心
      mesh.position.set(x, h / 2 + z, y);
      mesh.scale.set(1 / modelScale, 1, 1 / modelScale);
      mesh.renderOrder = 89; // 较高的渲染顺序

      // 克隆一个并旋转 90° 形成十字交叉
      const _mesh = mesh.clone().rotateY(Math.PI / 2);

      labelMesh && mesh.add(labelMesh);
      cylinderGroup.add(mesh, _mesh); // 添加两个平面
    }
  });
  cylinderGroup._category = "cylinder";
  return cylinderGroup;
};
