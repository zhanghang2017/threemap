/*
 * @Editor: zhanghang
 * @Description: 创建棱柱图系列选项
 * @Date: 2026-04-07 15:33:20
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-08 15:49:38
 */
import type { PrismSeriesOptions } from "../types";
import createLabel from "./createLabel";

// 创建标签并设置样式，用于显示棱柱数据
const label = createLabel();
label.itemStyle.padding = [0, 5, 0, 5];
label.itemStyle.backgroundColor = "rgba(50,50,50,0.7)";

/**
 * 创建棱柱图系列的默认配置选项
 * @description 使用 CSS 3D Transform 在地图上渲染立体棱柱效果，支持三种类型：
 *   - Type 1: 平面 2D div
 *   - Type 2: 使用椭圆和矩形模拟圆柱体（CSS 伪 3D）
 *   - Type 3: 真正的 CSS 3D 棱柱，使用 perspective + rotateX/Y/Z 实现六面体
 * 棱柱由三个 div 构成（正面、右侧面、顶面），通过 CSS Transform 组合成立体效果
 * @returns {PrismSeriesOptions} 棱柱图系列配置对象
 * @example
 * const prismOptions = createPrism();
 * prismOptions.prismType = 3; // 使用真 3D 棱柱
 * prismOptions.data = [{ value: 100, name: '北京', code: '110000' }];
 */
export default function (): PrismSeriesOptions {
  return {
    type: "prism", // 系列类型标识
    seriesName: "prism", // 系列名称
    size: 10, // 棱柱底面尺寸（像素单位）
    prismType: 3, // 棱柱类型：1 = 2D平面 | 2 = 伪3D圆柱 | 3 = 真3D棱柱
    maxHeight: 50, // 数据最大值对应的高度
    minHeight: 10, // 数据最小值对应的高度
    offset: [0, 0], // 位置偏移 [x, y]（像素单位）
    className: "", // 自定义 CSS 类名
    label, // 标签配置
    itemStyle: {
      color: [
        // 棱柱三个面的渐变色数组
        "linear-gradient(0deg, rgb(120, 131, 248) 0%, rgb(90, 174, 243) 100%)", // 正面渐变
        "linear-gradient(0deg, rgb(157, 77, 255) 0%, rgb(90, 174, 243) 100%)", // 右侧面渐变
        "linear-gradient(0deg, rgb(151, 203, 247) 0%, rgb(151, 203, 247) 100%)", // 顶面颜色
      ],
    },
    data: [], // 数据数组，每项需包含 value, name, code 等字段
  };
}
