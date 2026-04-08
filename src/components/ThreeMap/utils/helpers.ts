/**
 * 工具函数模块 - 替代 dsf.* 和 gisUtils
 *
 * 功能分类:
 * 1. 通用工具: uuid, deepMerge, isNumber, isString
 * 2. 样式转换: transformPx, transformRgb, transformStyle, labelStringToFunction
 * 3. GIS 工具: centerOfMass, bbox, featureCollection
 * 4. 色阶工具: rangeColor, separateColor
 */
import tinycolor from "tinycolor2";
import type { GeoJsonFeature, GeoJsonFeatureCollection, RangeRule } from "../types";

// ==================== 通用工具 ====================

/**
 * 生成 UUID v4 格式的随机字符串
 * @returns 如 "a1b2c3d4-e5f6-4a7b-9c8d-0e1f2a3b4c5d"
 */
export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 深度合并对象 - 递归合并嵌套属性
 * @param target - 目标对象
 * @param sources - 源对象数组，后面的优先级更高
 * @returns 合并后的目标对象
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: (Partial<T> | undefined)[]): T {
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source)) {
      const val = (source as any)[key];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        if (!(target as any)[key] || typeof (target as any)[key] !== "object") {
          (target as any)[key] = {};
        }
        deepMerge((target as any)[key], val);
      } else {
        (target as any)[key] = val;
      }
    }
  }
  return target;
}

export function isNumber(val: unknown): val is number {
  return typeof val === "number";
}

export function isString(val: unknown): val is string {
  return typeof val === "string";
}

// ==================== 样式转换 ====================

export function transformPx(val: number | string | undefined): string {
  if (typeof val === "number") return val + "px";
  if (typeof val === "string" && /^\d+(\.\d+)?$/.test(val)) return val + "px";
  return (val as string) ?? "";
}

export function transformArrayPx(arr: (number | string)[]): string {
  if (!Array.isArray(arr)) return "";
  return arr.map((v) => transformPx(v)).join(" ");
}

/**
 * 解析颜色字符串获取 RGB 和 opacity
 * @param color - 颜色字符串 (hex, rgb, rgba, 颜色名)
 * @returns { r, g, b, opacity } 对象
 */
export function transformRgb(color: string): { r: number; g: number; b: number; opacity: number } {
  const c = tinycolor(color);
  const rgb = c.toRgb();
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    opacity: rgb.a,
  };
}

/**
 * 将样式对象转换为 CSS 内联样式字符串
 */
export function transformStyle(styleObj: Record<string, any> | undefined): string {
  if (!styleObj) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(styleObj)) {
    if (value == null || value === "") continue;
    // camelCase to kebab-case
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    let cssValue: string = value;
    if (typeof value === "number" && !["opacity", "zIndex", "fontWeight"].includes(key)) {
      cssValue = value + "px";
    }
    if (Array.isArray(value)) {
      cssValue = value.map((v: any) => (typeof v === "number" ? v + "px" : v)).join(" ");
    }
    parts.push(`${cssKey}:${cssValue}`);
  }
  return parts.join(";");
}

/**
 * 标签模板字符串替换
 * {b} -> data.name, {c} -> data.value, {a} -> data.seriesName, {d} -> data.adcode
 */
export function labelStringToFunction(template: string, data: Record<string, any>): string {
  if (!template) return "";
  return template
    .replace(/\{a\}/g, data.seriesName ?? "")
    .replace(/\{b\}/g, data.name ?? "")
    .replace(/\{c\}/g, data.value ?? "")
    .replace(/\{d\}/g, data.adcode ?? "");
}

// ==================== GIS 工具 ====================

/**
 * 计算 GeoJSON Feature 的质心（简化版本）
 */
export function centerOfMass(feature: GeoJsonFeature | GeoJsonFeatureCollection): { geometry: { coordinates: [number, number] } } {
  const coords = getAllCoordinates(feature);
  if (coords.length === 0) return { geometry: { coordinates: [0, 0] } };

  let sumX = 0,
    sumY = 0;
  for (const [x, y] of coords) {
    sumX += x;
    sumY += y;
  }
  return {
    geometry: {
      coordinates: [sumX / coords.length, sumY / coords.length],
    },
  };
}

/**
 * 获取 GeoJSON 的 bbox [minX, minY, maxX, maxY]
 */
export function bbox(feature: GeoJsonFeature | GeoJsonFeatureCollection): [number, number, number, number] {
  const coords = getAllCoordinates(feature);
  if (coords.length === 0) return [0, 0, 0, 0];

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/**
 * 创建 FeatureCollection
 */
export function featureCollection(features: GeoJsonFeature[]): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: features,
  };
}

/**
 * 从 GeoJSON Feature 中提取所有坐标点
 */
function getAllCoordinates(geojson: any): [number, number][] {
  const coords: [number, number][] = [];

  function extract(obj: any): void {
    if (!obj) return;
    if (obj.type === "FeatureCollection") {
      obj.features.forEach(extract);
    } else if (obj.type === "Feature") {
      extract(obj.geometry);
    } else if (obj.geometry) {
      extract(obj.geometry);
    } else if (obj.type === "Polygon") {
      obj.coordinates.forEach((ring: any[]) => ring.forEach((p: [number, number]) => coords.push(p)));
    } else if (obj.type === "MultiPolygon") {
      obj.coordinates.forEach((poly: any[]) => poly.forEach((ring: any[]) => ring.forEach((p: [number, number]) => coords.push(p))));
    } else if (obj.type === "Point") {
      coords.push(obj.coordinates);
    } else if (obj.type === "LineString") {
      obj.coordinates.forEach((p: [number, number]) => coords.push(p));
    } else if (obj.type === "MultiLineString") {
      obj.coordinates.forEach((line: any[]) => line.forEach((p: [number, number]) => coords.push(p)));
    }
  }

  extract(geojson);
  return coords;
}

// ==================== 色阶工具 ====================

/**
 * 范围色阶 - 根据 value 在 [min, max] 区间线性插值颜色
 *
 * 应用场景: 热力图、数据可视化渐变色
 *
 * @param startColor - 起始颜色 (对应 min)
 * @param endColor - 结束颜色 (对应 max)
 * @param min - 最小值
 * @param max - 最大值
 * @param value - 当前值
 * @returns RGB 颜色字符串
 */
export function rangeColor(startColor: string, endColor: string, min: number, max: number, value: number | null | undefined): string {
  if (value == null || isNaN(value)) return endColor;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const sc = tinycolor(startColor).toRgb();
  const ec = tinycolor(endColor).toRgb();
  const r = Math.round(sc.r + (ec.r - sc.r) * ratio);
  const g = Math.round(sc.g + (ec.g - sc.g) * ratio);
  const b = Math.round(sc.b + (ec.b - sc.b) * ratio);
  return `rgb(${r},${g},${b})`;
}

/**
 * 分段色阶 - 根据规则区间匹配颜色
 *
 * 应用场景: 地图区域分级、等级分类
 *
 * @param value - 当前值
 * @param rules - 规则数组 [{ value, color }, ...]，按value升序排列
 * @param defaultColor - 默认颜色（未匹配时返回）
 * @returns 匹配的颜色或默认颜色
 */
export function separateColor(value: number, rules: RangeRule[], defaultColor: string): string {
  if (!Array.isArray(rules) || !rules.length) return defaultColor;
  for (let i = rules.length - 1; i >= 0; i--) {
    if (value >= rules[i]!.value) {
      return rules[i]!.color;
    }
  }
  return defaultColor;
}
