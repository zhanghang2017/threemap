/*
 * @Editor: zhanghang
 * @Description: 地图数据注册器 - 动态加载 GeoJSON 文件并计算边界
 * @Date: 2026-04-07 15:32:13
 * @LastEditors: zhanghang
 * @LastEditTime: 2026-04-08 18:29:59
 */
/**
 * 注册地图 - 加载本地 geoJSON 文件
 *
 * 依赖库说明：
 * - @turf/union: 合并多个多边形几何为一个统一的几何体
 * - @turf/truncate: 截断 GeoJSON 坐标精度，减少浮点数长度
 */
import type { GeoJsonFeatureCollection } from "../types";
import union from "@turf/union";
import truncate from "@turf/truncate";
import { featureCollection } from "@turf/helpers";

const geoModules = import.meta.glob<{ default: GeoJsonFeatureCollection }>("@/assets/geoJson/*.json");

/**
 * 注册地图数据 - 动态加载指定区域的 GeoJSON 文件
 * @param code - 地图区域代码（如 '100000' 代表中国）
 * @returns Promise<[边界数据, 完整数据]> - 返回边界和完整的 GeoJSON 数据
 * @description
 * 从 assets/geoJson 目录加载两个文件：
 *   - {code}.json: 完整的地图数据（包含所有子区域）
 *   - {code}_bound.json: 边界数据（仅外轮廓，用于优化渲染）
 * 如果边界文件不存在，则使用完整数据替代
 */
export const register = function (code: string): Promise<[GeoJsonFeatureCollection, GeoJsonFeatureCollection]> {
  code = code.toString();

  const fullKey = `/src/assets/geoJson/${code}.json`;
  const boundKey = `/src/assets/geoJson/${code}_bound.json`;

  // geoModules[key] 返回的是一个函数: () => Promise<{ default: GeoJsonFeatureCollection }>
  const fullLoader = geoModules[fullKey];
  let boundLoader = geoModules[boundKey];

  // 检查完整数据加载器是否存在
  if (!fullLoader) {
    return Promise.reject(new Error(`GeoJSON not found for code: ${code}`));
  }

  // 如果边界数据文件不存在，则动态计算边界
  if (!boundLoader) {
    // 动态计算边界的实现方案：
    // 1. 加载完整的 GeoJSON 数据
    // 2. 遍历所有 features（各个子区域）
    // 3. 使用 Turf.js 的 union 操作将所有区域合并为一个外轮廓
    // 4. 返回计算后的边界数据
    boundLoader = () =>
      fullLoader()
        .then((m) => m.default || (m as unknown as GeoJsonFeatureCollection))
        .then((data) => {
          // 计算所有 features 的并集作为统一边界
          // 确保至少有一个 feature 存在
          if (!data.features || data.features.length === 0) {
            return { default: data }; // 如果没有 features，直接返回原数据
          }

          let box = data.features[0]; // 初始边界为第一个 feature
          for (let i = 1; i < data.features.length; i++) {
            const feature = data.features[i];
            // 使用 Turf.js 进行几何运算：
            // - truncate: 截断坐标精度到小数点后6位，避免浮点数过长导致性能问题
            //   precision: 6 表示保留6位小数
            //   coordinates: 2 表示处理二维坐标（经纬度）
            // - union: 合并两个多边形为一个，结果是包含两者的最小外轮廓
            if (box && feature) {
              const truncatedBox = truncate(box as any, { precision: 6, coordinates: 2 });
              const truncatedFeature = truncate(feature as any, { precision: 6, coordinates: 2 });
              console.log(`Union ${i}:`, truncatedBox, truncatedFeature);
              const unionResult = union(featureCollection([truncatedBox as any, truncatedFeature as any]));

              if (unionResult) {
                box = unionResult as any; // 更新累积的边界
              }
            }
          }
          // 使用类型断言确保返回类型正确
          return { default: { type: "FeatureCollection", features: [box] } as GeoJsonFeatureCollection };
        });
  }

  // 并行加载边界数据和完整数据，返回格式: [边界, 完整]
  // 此时 boundLoader 一定存在（要么是从 geoModules 获取，要么是上面赋值的）
  return Promise.all([
    boundLoader!().then((m: { default: GeoJsonFeatureCollection }) => m.default || (m as unknown as GeoJsonFeatureCollection)),
    fullLoader().then((m: { default: GeoJsonFeatureCollection }) => m.default || (m as unknown as GeoJsonFeatureCollection)),
  ]);
};
