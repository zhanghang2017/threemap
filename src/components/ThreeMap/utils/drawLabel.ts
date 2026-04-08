import { labelStringToFunction, isNumber } from "./helpers";
import type { LabelOptions } from "../types";

/**
 * 绘制标签 DOM 元素 - 创建带样式的标签 HTML
 *
 * 功能:
 * - 应用边距、圆角、背景色、边框等样式
 * - 支持 formatter 自定义内容格式
 * - 支持模板字符串替换 {a} {b} {c} {d}
 *
 * @param options - 标签配置对象
 * @param data - 数据对象 (用于 formatter 和模板替换)
 * @returns HTMLDivElement - 标签 DOM 元素
 */
export const drawLabel = function (options: LabelOptions, data: Record<string, any>): HTMLDivElement {
  const { padding, borderRadius, backgroundColor, borderColor, borderWidth, textStyle } = options.itemStyle;

  const label = document.createElement("div");
  label.style.pointerEvents = "auto"; // 启用鼠标事件
  label.style.cursor = "pointer";

  // 应用基础样式
  label.style.padding = padding.join("px ") + "px";
  label.style.borderRadius = Array.isArray(borderRadius) ? borderRadius.join("px ") + "px" : borderRadius + "px";
  label.style.backgroundColor = backgroundColor;
  label.style.borderColor = borderColor;
  label.style.borderWidth = typeof borderWidth === "number" ? borderWidth + "px" : borderWidth;

  // 应用文本样式 (fontSize, color, fontWeight 等)
  Object.keys(textStyle).forEach((key) => {
    const val = (textStyle as any)[key];
    if (isNumber(val)) {
      (label.style as any)[key] = val + "px"; // 数字值添加 px
    } else if (Array.isArray(val)) {
      (label.style as any)[key] = val.join("px ") + "px"; // 数组值如 margin
    } else {
      (label.style as any)[key] = val; // 字符串值直接赋值
    }
  });

  // 生成标签内容
  const name = options.name;
  let innerHtml = "";
  if (typeof options.formatter === "function" && options.isFormatter) {
    // 使用自定义 formatter
    innerHtml = options.formatter(data);
  } else {
    // 使用模板字符串 {a} {b} {c} {d}
    innerHtml = labelStringToFunction(name, data);
  }
  label.innerHTML = innerHtml;
  label.className = `three-label-name ${options.className || ""}`; // 应用自定义类名

  return label;
};
