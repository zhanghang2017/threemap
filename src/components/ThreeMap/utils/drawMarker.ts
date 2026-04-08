/*
 * @Editor: zhanghang
 * @Description:
 * @Date: 2026-04-07 15:37:41
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-07 15:37:45
 */
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Group } from "three";
import markerImage from "@/assets/images/arrow.png";
import { drawLabel } from "./drawLabel";
import { transformPx } from "./helpers";
import type { ThreeMapContext, MarkerSeriesOptions, MapConfig } from "../types";

/**
 * 绘制 Marker - 使用 CSS2DObject 创建可交互的DOM标记点
 *
 * 实现原理:
 * 1. 创建 DOM 元素作为标记图标
 * 2. 使用 CSS2DRenderer 将 DOM 渲染到 3D 场景中的特定位置
 * 3. 支持自定义图标、尺寸、偏移量
 * 4. 绑定点击/双击事件
 *
 * 优势:
 * - DOM 元素天然支持 hover、click 等交互
 * - 可以使用 CSS 进行样式定制
 * - 图标总是面向摄像机,不会因视角改变而变形
 *
 * @param options - Marker 系列配置
 * @param config - 地图配置
 * @returns THREE.Group - 包含所有 Marker 的组
 */
export const drawMarker = function (this: ThreeMapContext, options: MarkerSeriesOptions, config: MapConfig): Group {
  const projection = this.projection;
  const seriesName = options.seriesName;
  const data = options.data || [];
  const markerGroup = new Group() as any;

  data.forEach((it) => {
    let x = 0,
      y = 0;

    // 坐标转换: 支持经纬度数组或区域代码
    if (Array.isArray(it.district)) {
      const point = projection(it.district as [number, number]);
      x = point[0];
      y = point[1];
    } else {
      // 根据区域代码查找中心点
      const district = this.districtData.find((city) => city.adcode == it.district);
      if (district) {
        const center = (district.centroid || district.center) as [number, number];
        it = { ...district, ...it }; // 合并区域属性
        const point = projection(center);
        x = point[0];
        y = point[1];
      } else {
        return false; // 未找到区域
      }
    }

    // 创建 Marker DOM 元素
    const marker = document.createElement("div");
    marker.ondragstart = function () {
      return false; // 禁止拖拽
    };

    // 实现双击和单击事件区分
    let now = new Date().getTime();
    let isDbl = false;
    marker.addEventListener("pointerdown", (e: PointerEvent) => {
      e.stopPropagation(); // 阻止事件冒泡
      e.preventDefault();
      const clickTime = new Date().getTime();

      // 300ms 内的两次点击识别为双击
      if (clickTime - now < 300) {
        isDbl = true;
        if (this.events["dblclick"]) {
          this.events["dblclick"].forEach((cb) => {
            cb({ ...it, seriesName });
          });
        }
      } else {
        // 延迟 300ms 后触发单击,避免误触
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

    const { symbolSize, symbolSizeFormatter, symbol = "default", offset = [0, 0], className, label } = options;
    let [width, height] = symbolSize;
    let [offsetX, offsetY] = offset;
    const markerPath = symbol === "default" ? markerImage : symbol;

    if (typeof symbolSizeFormatter == "function") {
      const size = symbolSizeFormatter(data);
      width = size[0];
      height = size[1];
    }

    const icon = document.createElement("div");
    icon.style.width = transformPx(width);
    icon.style.height = transformPx(height);
    icon.style.backgroundImage = `url(${markerPath})`;
    icon.style.backgroundSize = "100% 100%";

    marker.appendChild(icon);
    marker.className = `three-point-tag ${className || ""}`;
    marker.setAttribute("series", `three-point-tag_${seriesName}`);
    marker.style.userSelect = "none";
    marker.style.pointerEvents = "auto";
    marker.style.cursor = "pointer";

    const markerMesh = new CSS2DObject(marker) as any;
    const { depth, scale } = config;
    const z = (depth + 1) / scale;
    offsetX = offsetX / scale;
    offsetY = offsetY / scale;
    const offsetZ = 12 / scale;
    markerMesh.position.set(x + offsetX, z + offsetZ, y + offsetY);
    markerMesh._type = "marker";

    if (label.show) {
      const labelDom = drawLabel(label, { ...it, seriesName });
      marker.appendChild(labelDom);
    }
    markerGroup.add(markerMesh);
  });
  markerGroup._category = "marker";
  return markerGroup;
};
