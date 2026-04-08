/*
 * @Editor: zhanghang
 * @Description: 创建散点涟漪系列的默认配置选项
 * @Date: 2026-04-07 15:33:23
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-07 15:33:26
 */
import type { ScatterSeriesOptions } from "../types";
import createLabel from "./createLabel";

// 创建标签配置，散点通常不显示标签
const label = createLabel();
label.show = false; // 默认隐藏标签，避免视觉干扰

/**
 * 创建散点涟漪动画系列的默认配置选项
 * @description 在地图指定位置渲染涟漪扩散效果，由两部分组成：
 *   1. spotMesh: 中心点（CircleGeometry），大小固定
 *   2. ringMesh: 外圈环（RingGeometry），作为 spotMesh 的子对象，持续缩放和透明度变化
 * 动画逻辑：在 ThreeMap 的 render 循环中，通过修改 _scale 和 opacity 实现涟漪效果
 * @returns {ScatterSeriesOptions} 散点涟漪系列配置对象
 * @example
 * const scatterOptions = createScatter();
 * scatterOptions.spotColor = 'rgb(255, 0, 0)';
 * scatterOptions.data = [{ name: '北京', code: '110000' }];
 */
export default function (): ScatterSeriesOptions {
  return {
    type: "scatter", // 系列类型标识
    seriesName: "scatter", // 系列名称
    spotColor: "rgb(6, 209, 25)", // 中心点颜色
    spotSize: 8, // 中心点半径（像素单位）
    spotSizeFormatter: null, // 动态尺寸函数 (value) => number，根据数据值调整大小
    spotSeparate: 50, // 中心点数据值缩放系数，影响最终渲染大小
    ringColor: "rgb(95, 163, 111)", // 外圈环颜色
    ringRatio: 2, // 外圈环与中心点的半径比例（ringSize = spotSize * ringRatio）
    ringSeparate: 50, // 外圈环数据值缩放系数
    offset: [0, 0], // 位置偏移 [x, y]（像素单位）
    label, // 标签配置（默认不显示）
    data: [], // 数据数组，每项需包含 name, code 或坐标信息
  };
}
