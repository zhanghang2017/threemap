/*
 * @Editor: zhanghang
 * @Description:
 * @Date: 2026-04-07 15:37:45
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-08 15:24:53
 */
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Group } from "three";
import { drawLabel } from "./drawLabel";
import type { ThreeMapContext, PrismSeriesOptions, MapConfig } from "../types";

/**
 * 绘制 Prism - 使用 CSS 3D Transform 创建柱状图
 *
 * 三种类型:
 * 1. type=1 (平面柱): 简单的 2D div,无3D效果
 * 2. type=2 (圆柱): 上下两个椭圆+中间矩形,模拟圆柱体
 * 3. type=3 (棱柱): 使用 CSS 3D transform 构建真正的3D立方体
 *
 * 高度计算:
 * - realHeight = (maxHeight * value) / maxValue  // 按比例缩放
 * - 如果 realHeight < minHeight,使用 minHeight   // 保证最小可见高度
 *
 * CSS 3D Transform 原理 (type=3):
 * - 三个面: 前面(translateZ)、右面(rotateY + translateZ)、顶面(rotateX + translateZ)
 * - 每个面独立设置 transform 形成立体效果
 * - perspective 属性控制透视强度
 *
 * @param options - Prism 系列配置
 * @param config - 地图配置
 * @returns THREE.Group - 包含所有 Prism 的组
 */
export const drawPrism = function (this: ThreeMapContext, options: PrismSeriesOptions, config: MapConfig): Group {
  const projection = this.projection;
  const seriesName = options.seriesName;
  let data = options.data || [];
  const prismsGroup = new Group() as any;

  let maxValue = 0;
  data = data.filter((it) => it.value != undefined && it.value != null);
  data.forEach((it) => {
    maxValue = Math.max(maxValue, it.value!);
    maxValue = isNaN(maxValue) ? 1 : maxValue;
  });

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

    const prism = document.createElement("div");
    prism.ondragstart = function () {
      return false;
    };
    let now = new Date().getTime();
    let isDbl = false;
    prism.addEventListener("pointerdown", (e: PointerEvent) => {
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

    let { size, maxHeight, minHeight, itemStyle, offset = [0, 0], className, label } = options;
    const { color } = itemStyle;
    const [front, right, top] = color; // 三个面的颜色
    let [offsetX, offsetY] = offset;

    const width = size;
    // 根据 value 计算实际高度
    const realHeight = (maxHeight * it.value!) / maxValue;
    const height = realHeight < minHeight ? minHeight : realHeight; // 应用最小高度限制

    prism.className = `three-prism-tag ${className || ""}`;
    prism.setAttribute("series", `three-prism_${seriesName}`);
    prism.style.userSelect = "none";
    prism.style.pointerEvents = "auto";
    prism.style.cursor = "pointer";

    // 根据 prismType 生成不同的 HTML 结构
    const type = options.prismType;
    switch (type) {
      case 1: {
        // 平面柱: 简单的 2D 矩形
        const platHtml = `<div style="background:${front};width:${width}px;height:${height}px" class="three-plat-perceive"></div>`;
        prism.innerHTML = platHtml;
        break;
      }
      case 2: {
        // 圆柱: 上下椭圆 + 中间矩形
        const cylinderHtml = `<div style="background:${front};width:${width}px;height:${height}px" class="three-cylinder-perceive">
          <div class="top-cy" style="background:${right};width:${width}px;height:${width * 0.6}px;"></div>
          <div class="bottom-cy" style="background:${right};width:${width}px;height:${width * 0.6}px;"></div>
        </div>`;
        prism.innerHTML = cylinderHtml;
        break;
      }
      case 3: {
        // 棱柱: CSS 3D Transform 立方体
        // 前面: translateZ 向前移动 width/2
        // 右面: rotateY 90° 再 translateZ
        // 顶面: rotateX 90° 再 translateZ (位于顶部)
        const prismHtml = `<div class="three-prism-perceive">
        <div class="prism" style="width:${width}px;height:${height}px">
          <div style="background:${front}; transform: translateZ(${width / 2}px);"></div>
          <div style="background:${right};transform: rotateY(90deg) translateZ(${width / 2}px);"></div>
          <div style="background:${top};bottom:0;height:${width}px; transform: rotateX(90deg) translateZ(${height - width / 2}px) "></div>
        </div>
      </div>`;
        prism.innerHTML = prismHtml;
        break;
      }
    }

    const prismMesh = new CSS2DObject(prism) as any;
    const { depth, scale } = config;
    const z = (depth + 1) / scale;
    offsetX = offsetX / scale;
    offsetY = offsetY / scale;
    prismMesh.position.set(x + offsetX, z, y + offsetY);
    prismMesh._type = "prism";

    if (label.show) {
      const labelDom = drawLabel(label, it);
      prism.appendChild(labelDom);
    }
    prismsGroup.add(prismMesh);
  });
  prismsGroup._category = "prism";
  return prismsGroup;
};
