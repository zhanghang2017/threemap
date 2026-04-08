import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import tinycolor from "tinycolor2";
import { drawLabel } from "./drawLabel";
import type { ThreeMapContext, ScatterSeriesOptions, MapConfig } from "../types";

/**
 * 绘制扩散点 - 创建带涓漪动画的圆形标记
 *
 * 实现原理:
 * 1. 中心点: 圆形 Mesh (实心圆)
 * 2. 涓漪环: RingGeometry (空心圆环)
 * 3. 动画: 每帧缩放 ringMesh._scale,在 ThreeMap.ts render 循环中更新
 *
 * 几何结构:
 * - spotMesh (中心点): CircleGeometry,始终保持固定大小
 * - ringMesh (涓漪环): RingGeometry,附加到 spotMesh 上作为子对象
 * - labelMesh (CSS2D 标签): 可选,显示数值/名称
 *
 * 动画逻辑 (在 render 中处理):
 * - _scale 从 1 递增到某个值，然后重置
 * - 同时降低 ringMesh 的 opacity 实现淡出效果
 *
 * @param options - Scatter 系列配置
 * @param config - 地图配置
 * @returns THREE.Group - 包含所有 Scatter 的组
 */
export const drawScatter = function (this: ThreeMapContext, options: ScatterSeriesOptions, config: MapConfig): THREE.Group {
  const projection = this.projection;
  const modelScale = this.scale;
  const seriesName = options.seriesName;
  const data = options.data || [];
  const scatterGroup = new THREE.Group() as any;
  const { depth, scale } = config;
  const z = (depth + 1) / scale;
  let { spotColor, spotSize, spotSizeFormatter, spotSeparate, ringColor, ringRatio, ringSeparate, offset, label } = options;

  const spotFormat = tinycolor(spotColor);
  const spotOpacity = spotFormat.getAlpha();
  const spotRgb = spotFormat.toRgb();
  spotColor = `rgb(${spotRgb.r},${spotRgb.g},${spotRgb.b})`;

  const ringFormat = tinycolor(ringColor);
  const ringOpacity = ringFormat.getAlpha();
  const ringRgb = ringFormat.toRgb();
  ringColor = `rgb(${ringRgb.r},${ringRgb.g},${ringRgb.b})`;

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
    let size = spotSize;

    // 如果提供了尺寸格式化函数,使用它计算实际尺寸
    if (typeof spotSizeFormatter == "function") {
      size = spotSizeFormatter(data);
    }

    // 计算涓漪环大小: 中心点大小 * ringRatio
    let ringSize = (size * ringRatio) / scale;
    size = size / scale; // 根据 scale 调整

    // 创建中心点几何体：CircleGeometry(半径, 分段数)
    const spotGeometry = new THREE.CircleGeometry(size, spotSeparate);
    const spotMaterial = new THREE.MeshBasicMaterial({
      color: spotColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: spotOpacity,
    });

    const spotMesh = new THREE.Mesh(spotGeometry, spotMaterial) as any;

    // 应用偏移量
    let [offsetX, offsetY] = offset;
    offsetX = offsetX / scale;
    offsetY = offsetY / scale;
    spotMesh.position.set(x + offsetX, z, y + offsetY);

    // 根据 modelScale 调整大小，保持在不同缩放下可见
    spotMesh.scale.set(1 / modelScale, 1 / modelScale, 1 / modelScale);

    // X 轴旋转 -90°，将圆形放到 XZ 平面上
    spotMesh.rotation.x = -Math.PI / 2;

    // 创建涓漪环几何体：RingGeometry(内半径, 外半径, 分段数)
    const RingGeometry = new THREE.RingGeometry(size, ringSize, ringSeparate);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: ringOpacity,
    });

    const ringMesh = new THREE.Mesh(RingGeometry, ringMaterial) as any;
    ringMesh._scale = 1; // 初始缩放值,用于动画更新
    ringMesh.renderOrder = 85; // 渲染顺序优先级

    // 将涓漪环附加到中心点上
    spotMesh.add(ringMesh);

    spotMesh._privateData = it; // 存储原始数据
    spotMesh._type = "scatter";

    if (label.show) {
      const labelDom = drawLabel(label, it);
      const labelMesh = new CSS2DObject(labelDom) as any;
      labelMesh._type = "label";
      spotMesh.add(labelMesh);

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

    scatterGroup.add(spotMesh);
  });
  scatterGroup._category = "scatter";
  return scatterGroup;
};
