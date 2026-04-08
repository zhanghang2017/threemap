import type { LabelOptions } from "../types";

/**
 * 创建标签的默认样式配置
 * @description 标签使用 CSS2DObject 渲染，会自动跟随 3D 场景中的位置投影到屏幕空间
 * 支持模板字符串替换：{a} = 系列名称, {b} = 数据名称, {c} = 数据值, {d} = 百分比
 * @returns {LabelOptions} 标签配置对象
 * @example
 * const label = createLabel();
 * label.name = '{b}: {c}'; // 显示 "北京: 100"
 * label.itemStyle.backgroundColor = 'rgba(0,0,0,0.7)';
 */
export default function (): LabelOptions {
  return {
    show: true, // 是否显示标签
    name: "{b}", // 标签文本内容，支持模板字符串
    isFormatter: false, // 是否使用自定义 formatter 函数
    formatter: null, // 自定义格式化函数 (data) => string
    formatterHtml: "", // 自定义 HTML 字符串（优先级高于 formatter）
    className: "", // 自定义 CSS 类名
    offset: [0, 0], // 标签位置偏移 [x, y]（像素单位）
    itemStyle: {
      padding: [0, 0, 0, 0], // 内边距 [上, 右, 下, 左]
      backgroundColor: "rgba(50,50,50,0)", // 背景颜色，默认完全透明
      borderRadius: 5, // 圆角半径
      borderColor: "rgba(255,255,255,0)", // 边框颜色，默认透明
      borderWidth: 0, // 边框宽度
      textStyle: {
        fontSize: 12, // 字体大小
        color: "#FFF", // 文字颜色
        fontStyle: "normal", // 字体样式：normal | italic | oblique
        fontWeight: "normal", // 字体粗细：normal | bold | 100-900
        fontFamily: "Microsoft Yahei", // 字体族
        textDecoration: "", // 文本装饰：underline | line-through
        textShadow: "", // 文字阴影：'2px 2px 4px #000'
      },
    },
  };
}
