import { transformStyle } from "./helpers";
import type { TooltipOptions, TooltipInstance, ThreeMapContext } from "../types";

/**
 * 提示框渲染 - 根据当前拾取的 Mesh 更新 Tooltip 内容和位置
 *
 * 触发时机:
 * - 在 ThreeMap.ts render 循环中，raycaster 拾取到分区 Mesh 时调用
 *
 * @this ThreeMapContext
 */
export const tooltipRender = function (this: ThreeMapContext): void {
  const { tooltip, mouseEvent: e, tooltipDom } = this;

  // 隐藏之前的 Tooltip
  if (tooltip) {
    tooltip._hide();
  }

  // 如果拾取到分区 Mesh 且 Tooltip 开启
  if (this.pickDistrictMesh && tooltip && e) {
    const mesh = this.pickDistrictMesh.object as any;
    const { deriveColor, ...properties } = mesh._privateData; // 排除 deriveColor

    // 设置 Tooltip 位置：鼠标位置 + 偏移
    tooltipDom.style.left = e.offsetX + 15 + "px";
    tooltipDom.style.top = e.offsetY + 2 + "px";

    // 显示 Tooltip 内容
    tooltip._show(properties);
  }
};

/**
 * 添加提示框 - 创建 Tooltip 实例
 *
 * 功能:
 * - 创建一个 Tooltip 实例，包含 _show 和 _hide 方法
 * - 支持 formatter 自定义内容
 * - 支持样式配置 (itemStyle)
 *
 * @this ThreeMapContext
 * @param options - Tooltip 配置对象
 * @returns TooltipInstance | undefined
 */
export const addTooltip = function (this: ThreeMapContext, options: TooltipOptions): TooltipInstance | undefined {
  const { show, content, formatter, itemStyle: tooltipStyle } = options;
  const { tooltipDom } = this;

  if (show) {
    // 将 itemStyle 对象转为 CSS 字符串
    const style = transformStyle(tooltipStyle);

    // 包装函数: 生成 Tooltip HTML 内容
    const _wrapper = function (data: any): string {
      let _content = "";
      if (typeof formatter === "function") {
        _content = formatter(data); // 自定义 formatter
      } else {
        _content = content; // 静态内容
      }
      return _content ? `<div style="${style}">${_content}</div>` : "";
    };

    tooltipDom.innerHTML = "";

    // 创建 Tooltip 实例
    const tooltip: TooltipInstance = {
      _type: "tooltip",
      _show: function (data: any) {
        tooltipDom.innerHTML = _wrapper(data);
        tooltipDom.style.display = "block"; // 显示 Tooltip
      },
      _hide() {
        tooltipDom.style.display = "none"; // 隐藏 Tooltip
      },
    };

    return tooltip;
  }
};
