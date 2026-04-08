/*
 * @Editor: zhanghang
 * @Description: 创建标记点系列的默认配置选项
 * @Date: 2026-04-07 15:33:07
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-07 15:33:17
 */
import type { MarkerSeriesOptions } from "../types";
import createLabel from "./createLabel";

// 创建标签并设置半透明背景，适合作为标记点的提示信息
const label = createLabel();
label.itemStyle.padding = [2, 5, 2, 5]; // 设置紧凑的内边距
label.itemStyle.backgroundColor = "rgba(50,50,50,0.7)"; // 半透明深色背景

/**
 * 创建标记点系列的默认配置选项
 * @description 用于在地图指定位置放置可交互的标记图标（使用 CSS2DObject）
 * 支持功能：
 *   - 自定义图标（symbol 可以是内置类型或自定义 DOM 元素）
 *   - 动态尺寸（通过 symbolSizeFormatter 根据数据动态调整）
 *   - 点击事件（单击和双击区分，双击会穿透到地图）
 * @returns {MarkerSeriesOptions} 标记点系列配置对象
 * @example
 * const markerOptions = createMarker();
 * markerOptions.data = [{ value: 100, name: '北京', code: '110000' }];
 * markerOptions.symbolSizeFormatter = (value) => [value / 5, value / 5];
 */
export default function (): MarkerSeriesOptions {
  return {
    type: "marker", // 系列类型标识
    seriesName: "marker", // 系列名称
    symbol: "default", // 标记图标类型，'default' 使用内置 Pin 图标
    symbolSize: [20, 20], // 标记尺寸 [宽, 高]（像素单位）
    symbolSizeFormatter: null, // 动态尺寸函数 (value) => [width, height]
    offset: [0, 0], // 位置偏移 [x, y]（像素单位）
    className: "", // 自定义 CSS 类名，用于样式覆盖
    label, // 标签配置，通常显示数据名称或值
    data: [], // 数据数组，每项需包含 name, code 或坐标信息
  };
}
