import type { CylinderSeriesOptions } from "../types";
import createLabel from "./createLabel";

// 创建默认标签配置，并设置标签垂直偏移
const label = createLabel();
label.offset = [0, 1] as [number, number]; // 标签向上偏移 1 个单位，避免与柱体重叠

/**
 * 创建圆柱图系列的默认配置选项
 * @description 用于在地图上渲染 3D 柱状图，支持两种模式：
 *   - cylinder 模式：使用 CylinderGeometry 创建真实的圆柱体，带垂直渐变色
 *   - tower 模式：使用两个正交的 PlaneGeometry 创建十字交叉的光柱效果
 * @returns {CylinderSeriesOptions} 圆柱图系列配置对象
 * @example
 * const cylinderOptions = createCylinder();
 * cylinderOptions.data = [{ value: 100, name: '北京', code: '110000' }];
 * map.addSeries(cylinderOptions);
 */
export default function (): CylinderSeriesOptions {
  return {
    type: "cylinder", // 系列类型标识
    seriesName: "cylinder", // 系列名称，用于后续引用和管理
    mode: "cylinder", // 渲染模式：'cylinder' = 真实圆柱体 | 'tower' = 光柱效果
    towerColor: "#FFF", // tower 模式下的光柱颜色
    color: ["#003e62", "#00E6E6"], // cylinder 模式下的渐变色：[底部颜色, 顶部颜色]
    size: 25, // 圆柱体底面半径（像素单位）
    maxHeight: 100, // 数据最大值对应的高度
    minHeight: 10, // 数据最小值对应的高度
    separate: 100, // 数据值缩放系数，用于调整高度映射
    offset: [0, 0], // 位置偏移 [x, y]（像素单位）
    label, // 标签配置
    data: [], // 数据数组，每项需包含 value, name, code 等字段
  };
}
