/*
 * @Editor: zhanghang
 * @Description: 创建 ThreeMap 的默认全局配置选项
 * @Date: 2026-04-07 15:33:26
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-08 18:34:02
 */
import type { ThreeMapOptions } from "../types";
import createLabel from "./createLabel";

/**
 * 创建 ThreeMap 的默认全局配置选项
 * @description 此配置是整个 3D 地图的核心配置，包含所有渲染参数、交互控制、样式设置等
 * 主要配置模块：
 *   - config: 基础配置（缩放、旋转控制、拉伸高度等）
 *   - camera: 相机位置
 *   - grid: 坐标网格辅助线
 *   - foundation: 底座旋转动画
 *   - tooltip: 悬停提示框
 *   - mirror: 镜面反射效果
 *   - wall: 边界墙体
 *   - texture: 区域表面纹理
 *   - glow: Bloom 辉光后处理
 *   - itemStyle: 区域颜色和可视化映射
 *   - emphasis: 鼠标悬停高亮
 *   - lineStyle/outLineStyle: 边界线样式
 *   - label: 区域标签
 * @returns {ThreeMapOptions} 完整的地图配置对象
 */
const createDefaultOptions = (): ThreeMapOptions => {
  // 创建默认标签配置（用于地图区域标签）
  const label = createLabel();

  return {
    // ========== 基础配置 ==========
    config: {
      autoScale: true, // 是否自动缩放地图以适应容器
      disableRotate: false, // 是否禁用鼠标旋转控制
      disableZoom: false, // 是否禁用鼠标缩放控制
      autoScaleFactor: 1, // 自动缩放的额外系数（1 = 原始大小）
      scale: 100, // 地图整体缩放比例
      depth: 35, // 区域拉伸高度（ExtrudeGeometry 的挤出深度）
    },
    // ========== 自动旋转配置 ==========
    autoRotate: {
      autoRotate: false, // 是否启用相机自动旋转
      autoRotateSpeed: 2, // 自动旋转速度（度/秒）
    },
    // ========== 相机位置配置 ==========
    camera: {
      x: 0.8, // 相机 X 轴位置（乘以地图缩放系数）
      y: 6, // 相机 Y 轴位置（高度）
      z: 3, // 相机 Z 轴位置（深度）
    },
    // ========== 网格辅助线配置 ==========
    grid: {
      show: false, // 是否显示坐标网格（用于调试）
      color: "#2BD9FF", // 网格线颜色
      opacity: 0.2, // 网格线透明度
    },
    // ========== 底座动画配置 ==========
    foundation: {
      show: false, // 是否显示底座
      size: 800, // 底座平面尺寸
      speed: 0.5, // 底座旋转速度（每帧旋转的角度）
      image: "default", // 底座纹理图片（'default' 使用内置纹理）
      isRotate: true, // 是否启用旋转动画
      static: false, // 是否为静态底座（不旋转）
    },
    // ========== Tooltip 提示框配置 ==========
    tooltip: {
      show: true, // 是否启用 tooltip
      content: "", // 静态内容（优先级低于 formatter）
      styleType: "0", // 样式类型标识
      isFormatter: false, // 是否使用自定义 formatter
      formatterHtml: "", // 自定义 HTML（优先级最高）
      // 默认格式化函数：显示名称和数值
      formatter: function (data: any) {
        const name = data.name || "-- ";
        const value = data.value === undefined ? "-- " : data.value;
        return "<span>" + name + "：</span>" + "<span>" + value + "</span>";
      },
      itemStyle: {
        // Tooltip 容器样式
        backgroundColor: "rgba(8, 20, 45, 0.82)", // 半透明深蓝背景
        borderColor: "rgba(72, 204, 255, 0.45)", // 淡蓝色边框
        borderWidth: 0,
        padding: [10, 10, 10, 10], // 内边距 [上, 右, 下, 左]
        color: "#DFF6FF", // 文字颜色
        fontSize: 14,
        minWidth: 80, // 最小宽度
        width: "max-content", // 自适应内容宽度
        borderRadius: 5,
        borderStyle: "solid",
      },
    },
    // ========== 镜面反射配置 ==========
    mirror: {
      show: false, // 是否显示镜面反射效果（在地图下方渲染翻转的副本）
      color: ["#020B1F", "#00D2FF"], // 镜面渐变色：[底部颜色, 顶部颜色]
    },
    // ========== 边界墙体配置 ==========
    wall: {
      show: false, // 是否显示区域边界的垂直墙体
      height: 40, // 墙体高度
      color: "#4DEBFF", // 墙体颜色（支持 alphaMap 渐变透明）
    },
    // ========== 区域表面纹理配置 ==========
    texture: {
      show: true, // 是否启用纹理贴图
      autoRepeat: false, // 是否自动计算纹理重复（false 时使用手动 repeat 值）
      repeat: { x: 0.0927, y: 0.124 }, // 纹理 UV 重复次数
      offset: { x: 0.5918, y: 0.324 }, // 纹理 UV 偏移量
      image: "default", // 纹理图片（'default' 使用内置纹理）
    },
    // ========== 地图数据配置 ==========
    map: "100000", // 地图区域代码（100000 = 中国）
    mapName: "china", // 地图名称标识
    // ========== Bloom 辉光后处理配置 ==========
    glow: {
      show: true, // 是否启用 Bloom 效果
      threshold: 0, // 发光阈值（亮度低于此值的不会发光）
      strength: 1, // 发光强度
      radius: 0, // 发光扩散半径
    },
    // ========== 区域样式配置 ==========
    itemStyle: {
      range: {
        // 数据可视化映射配置
        show: true, // 是否启用数据映射（影响区域颜色）
        mode: "range", // 映射模式：'range' = 连续渐变 | 'separate' = 分段规则
        rules: [
          // 分段规则数组（mode='separate' 时使用）
          {
            value: 0, // 规则阈值
            color: "#27F4FF", // 对应颜色
            label: ">=0", // 标签文本
          },
        ],
        color: ["#18D7FF", "#2665FF"], // 连续渐变色（mode='range' 时使用）
        min: 0, // 数据最小值
        max: 1000, // 数据最大值
        visualMap: {
          // 可视化图例配置（类似 ECharts visualMap）
          show: false, // 是否显示图例
          left: "2%", // 图例水平位置
          top: "2%", // 图例垂直位置
          maxText: "高", // 最大值文本标签
          minText: "低", // 最小值文本标签
          textStyle: {
            // 图例文字样式
            fontSize: 12,
            color: "#FFF",
            fontStyle: "normal",
            fontWeight: "normal",
            fontFamily: "Microsoft Yahei",
            textDecoration: "",
            textShadow: "",
          },
        },
      },
      topColor: "rgba(42, 233, 255, 0.95)", // 区域顶面颜色（ExtrudeGeometry 上表面）
      sideColor: "rgba(59, 132, 255, 0.92)", // 区域侧面颜色（挤出侧面）
      uColor: "rgba(19, 48, 128, 1)", // Shader 扫光动画的 U 通道颜色
    },
    // ========== 鼠标悬停高亮配置 ==========
    emphasis: {
      show: false, // 是否启用悬停高亮效果
      topColor: "#73F8FF", // 悬停时的顶面颜色
      textStyle: {
        // 悬停时的文本样式（用于标签）
        fontSize: 12,
        color: "#FFF",
        fontStyle: "normal",
        fontWeight: "normal",
        fontFamily: "Microsoft Yahei",
        textDecoration: "",
        textShadow: "",
      },
    },
    // ========== 边界线样式配置 ==========
    lineStyle: {
      color: "#78CFFF", // 区域内部边界线颜色（如省内市界）
    },
    outLineStyle: {
      color: "rgba(83, 198, 230, 1)", // 区域外部轮廓线颜色（如省界）
    },
    // ========== 区域标签配置 ==========
    label: {
      ...label, // 继承默认标签配置
      show: true, // 默认不显示区域标签（避免地图过于拥挤）
    },
    // ========== 系列和数据配置 ==========
    seriesName: "map", // 主地图系列名称
    data: [], // 区域数据数组（用于 itemStyle.range 的数据映射）
    series: [], // 附加系列数组（存放 cylinder, flight, marker 等）
  };
};

export default createDefaultOptions;
