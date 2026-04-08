<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import ThreeMap from "./ThreeMap";
import ControlPanel from "./ControlPanel.vue";
import createDefaultOptions from "./options/threeOption";
import createMarker from "./options/createMarker";
import createFlight from "./options/createFlight";
import createPrism from "./options/createPrism";
import createScatter from "./options/createScatter";
import createCylinder from "./options/createCylinder";
import type { ThreeMapOptions, GeoJsonFeatureCollection } from "./types";

// ==================== Types ====================
interface AreaProp {
  area: string;
  showName: string;
}

interface MapListItem {
  name: string;
  value: string;
}

type SeriesType = "marker" | "flight" | "prism" | "scatter" | "cylinder";

const areaRef = ref<AreaProp>({ area: "100000", showName: "中国" });
const threeOptionsRef = ref<ThreeMapOptions>(createDefaultOptions());

// ==================== Refs ====================
const mapRef = ref<HTMLDivElement | null>(null);
const tooltipRef = ref<HTMLDivElement | null>(null);

let map: ThreeMap | null = null;
const mapList = ref<MapListItem[]>([]);
const isInHole = ref(false);
const loading = ref(true);
const currentMapJson = ref<GeoJsonFeatureCollection | null>(null);
const seriesTypeOptions: { name: SeriesType; value: string }[] = [
  {
    name: "marker",
    value: "地标",
  },
  {
    name: "flight",
    value: "飞行线",
  },
  {
    name: "prism",
    value: "2d柱体",
  },
  {
    name: "scatter",
    value: "散点",
  },
  {
    name: "cylinder",
    value: "3d柱状",
  },
];

// ==================== Computed ====================
const showBack = computed(() => mapList.value.length > 1);

const range = computed(() => (threeOptionsRef.value as any).itemStyle.range);

const getVisualMapColumnStyle = computed(() => {
  const r = range.value;
  if (r.color && r.color.length) {
    const gradientValue = r.color.map((item: string, index: number) => `${item} ${(index / r.color.length) * 100}%`).join();
    return {
      "background-color": r.color[0],
      "background-image": `linear-gradient(to top, ${gradientValue})`,
    };
  }
  return {};
});

// ==================== Methods ====================

/**
 * 将 visualMap 规则颜色转换为内联样式。
 */
function getVisualMapColorStyle(color: { color: string }) {
  return { backgroundColor: color.color };
}

/**
 * 返回上一级地图层级并重新渲染。
 */
function backMapFn(): void {
  mapList.value.pop();
  const o = mapList.value[mapList.value.length - 1]!;
  const code = o.value;
  const mapName = o.name;
  (threeOptionsRef.value as any).map = code;
  (threeOptionsRef.value as any).mapName = mapName;
  isInHole.value = true;
  reset();
}

/**
 * 从 GeoJSON 要素中随机抽取指定数量，避免每次生成数据都固定同一批区域。
 */
function getRandomFeatures(mapJson: GeoJsonFeatureCollection, count = 10): GeoJsonFeatureCollection["features"] {
  const source = [...mapJson.features];
  for (let i = source.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j]!, source[i]!];
  }
  return source.slice(0, Math.min(count, source.length));
}

/**
 * 根据系列类型生成演示数据。
 * - flight: 生成随机起终点连线
 * - other: 生成带 value 的区域数据
 */
function createdDataRandom(mapJson: GeoJsonFeatureCollection, type: string): any[] {
  const features = getRandomFeatures(mapJson, 10);
  if (type === "flight") {
    if (features.length < 2) return [];
    const codes: string[] = [];
    features.forEach((it) => {
      codes.push(it.properties.adcode as string);
    });
    const end = codes[Math.floor(Math.random() * codes.length)]!;
    const line: { start: string; end: string }[] = [];
    for (let i = 0; i < codes.length; i++) {
      const start = codes[i]!;
      if (start !== end) {
        line.push({ start, end });
      }
    }
    return line;
  } else {
    const res: any[] = [];
    features.forEach((it) => {
      res.push({
        district: it.properties.adcode,
        name: it.properties.name,
        value: Math.floor(100 + 900 * Math.random()),
      });
    });
    return res;
  }
}

/**
 * 统一重设地图事件并调用 setOption 触发渲染。
 */
function reset(): void {
  if (!map || !threeOptionsRef.value) return;

  try {
    map.off("click");
    map.off("dblclick");
    map.off("change");
  } catch (error) {
    console.log(error);
  }

  map.on("dblclick", (data: any) => {
    if (data.adcode) {
      handleInChangeMap(data.adcode + "", data.name);
    }
  });

  const options = threeOptionsRef.value;

  const refresh = !isInHole.value;
  map.setOption(options, refresh);
}

/**
 * 进入下一级地图（双击区域）并刷新系列数据。
 */
function handleInChangeMap(code: string, mapName: string): void {
  if (map) {
    isInHole.value = true;
    map.registerMap(code, code, threeOptionsRef.value.config).then((mapJson) => {
      currentMapJson.value = mapJson;
      mapList.value.push({
        name: mapName,
        value: code,
      });
      (threeOptionsRef.value as any).map = code;
      (threeOptionsRef.value as any).mapName = mapName || code;

      threeOptionsRef.value.series.forEach((it: any) => {
        it.data = createdDataRandom(mapJson, it.type);
      });
      reset();
    });
  }
}

/**
 * 组件内部初始化入口。
 */
function init(): void {
  reset();
}

/**
 * 依据系列类型创建默认系列配置对象。
 */
function createSeriesByType(type: SeriesType): any {
  if (type === "marker") return createMarker();
  if (type === "flight") return createFlight();
  if (type === "prism") return createPrism();
  if (type === "scatter") return createScatter();
  return createCylinder();
}

/**
 * 面板配置变更后强制全量刷新，保证环境层与系列层都生效。
 */
function applyPanelChanges(): void {
  isInHole.value = false;
  reset();
}

/**
 * 新增一个指定类型的系列，并在当前地图上生成初始数据。
 */
function addSeries(type: SeriesType): void {
  const series = createSeriesByType(type);
  series.seriesName = `${series.type}-${threeOptionsRef.value.series.length + 1}`;
  if (currentMapJson.value) {
    series.data = createdDataRandom(currentMapJson.value, series.type);
  }
  threeOptionsRef.value.series.push(series);
  applyPanelChanges();
}

/**
 * 删除指定索引的系列。
 */
function removeSeries(index: number): void {
  threeOptionsRef.value.series.splice(index, 1);
  applyPanelChanges();
}

/**
 * 重新生成指定系列的数据并刷新显示。
 */
function regenerateSeriesData(index: number): void {
  if (!currentMapJson.value) return;
  const target: any = threeOptionsRef.value.series[index];
  if (!target) return;
  target.data = createdDataRandom(currentMapJson.value, target.type);
  applyPanelChanges();
}

// ==================== Lifecycle ====================
onMounted(() => {
  map = new ThreeMap(mapRef.value!, tooltipRef.value!, { isDesign: false });

  const { area, showName } = areaRef.value;
  const code = area;

  (threeOptionsRef.value as any).map = area;
  (threeOptionsRef.value as any).mapName = showName;

  mapList.value.push({
    name: showName,
    value: code,
  });

  map
    .registerMap(code, code, threeOptionsRef.value.config)
    .then((mapJson) => {
      currentMapJson.value = mapJson;
      threeOptionsRef.value.series.forEach((it: any) => {
        if (!it.data || !it.data.length) {
          it.data = createdDataRandom(mapJson, it.type);
        }
      });

      init();
      loading.value = false;
    })
    .catch((err: unknown) => {
      console.error("地图加载失败:", err);
      loading.value = false;
    });
});

onBeforeUnmount(() => {
  map && map.destroyMap();
  map = null;
});
</script>

<template>
  <div class="dv-three-map">
    <div v-if="loading" class="dv-three-loading">加载中...</div>
    <div ref="mapRef" class="dv-three-map-canvas"></div>
    <div ref="tooltipRef" class="dv-three-tooltip"></div>

    <ControlPanel
      :options="threeOptionsRef"
      :series-type-options="seriesTypeOptions"
      @apply="applyPanelChanges"
      @add-series="addSeries"
      @remove-series="removeSeries"
      @regenerate-series="regenerateSeriesData"
    />

    <!-- 视觉映射 -->
    <div class="three-visual-wrap">
      <div class="three-visual">
        <div class="three-visual-gradient" v-if="range.mode === 'range'">
          <div class="gradient" :style="getVisualMapColumnStyle"></div>
          <div class="high">
            <div>{{ range.visualMap.maxText }}</div>
            <div>{{ range.max }}</div>
          </div>
          <div class="low">
            <div>{{ range.visualMap.minText }}</div>
            <div>{{ range.min }}</div>
          </div>
        </div>
        <div class="three-visual-color-group" v-else-if="range.mode === 'separate'">
          <div class="three-visual-color" v-for="(color, colorIndex) in range.rules" :key="colorIndex">
            <div class="color" :style="getVisualMapColorStyle(color)"></div>
            <div class="name">{{ color.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 返回按钮 -->
    <div class="back-three-map" @click="backMapFn" v-if="showBack">
      <span style="margin-right: 4px">< back </span>
    </div>
  </div>
</template>

<style>
/* ==================== 容器 ==================== */
.dv-three-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.dv-three-map-canvas {
  width: 100%;
  height: 100%;
  position: relative;
}

.dv-three-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 14px;
  z-index: 10;
}

/* ==================== Tooltip ==================== */
.dv-three-tooltip {
  position: absolute;
  display: none;
  pointer-events: none;
  z-index: 100;
}

/* ==================== 视觉映射 ==================== */
.three-visual-wrap {
  position: absolute;
  z-index: 10;
  left: 16px;
  bottom: 16px;
}

.three-visual {
  color: #fff;
  font-size: 12px;
}

.three-visual-gradient {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.three-visual-gradient .gradient {
  width: 20px;
  height: 120px;
  border-radius: 2px;
}

.three-visual-gradient .high,
.three-visual-gradient .low {
  text-align: center;
  margin: 4px 0;
}

.three-visual-color-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.three-visual-color {
  display: flex;
  align-items: center;
  gap: 6px;
}

.three-visual-color .color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

/* ==================== 返回按钮 ==================== */
.back-three-map {
  position: absolute;
  cursor: pointer;
  z-index: 10;
  color: #fff;
  font-size: 20px;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  user-select: none;
  display: flex;
  align-items: center;
}

.back-three-map:hover {
  background: rgba(0, 0, 0, 0.5);
}

/* ==================== Canvas Label / Marker / Prism ==================== */
.dv-three-map-canvas .three-point-tag {
  position: relative;
}

.dv-three-map-canvas .three-point-tag .three-label-name {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -100%);
  width: max-content;
  box-sizing: border-box;
}

.dv-three-map-canvas .three-prism-tag .three-label-name {
  position: absolute;
  top: -50%;
  left: 50%;
  width: max-content;
  box-sizing: border-box;
  transform: translate(-50%, -100%);
}

.dv-three-map-canvas .three-prism-tag .three-prism-perceive {
  perspective: 1000px;
  transform: translateY(-50%);
}

.dv-three-map-canvas .three-prism-tag .three-prism-perceive .prism {
  position: relative;
  transform-style: preserve-3d;
  transform: rotateX(-20deg) rotateY(-30deg);
}

.dv-three-map-canvas .three-prism-tag .three-prism-perceive .prism > div {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(0, 128, 255, 0.7);
}

.dv-three-map-canvas .three-prism-tag .three-plat-perceive {
  transform: translateY(-50%);
}

.dv-three-map-canvas .three-prism-tag .three-cylinder-perceive {
  position: relative;
  transform: translateY(-50%);
}

.dv-three-map-canvas .three-prism-tag .three-cylinder-perceive > div {
  position: absolute;
  left: 0;
  border-radius: 50%;
}

.dv-three-map-canvas .three-prism-tag .three-cylinder-perceive > div.top-cy {
  top: 0;
  transform: translateY(-50%);
}

.dv-three-map-canvas .three-prism-tag .three-cylinder-perceive > div.bottom-cy {
  bottom: 0;
  transform: translateY(50%);
}

.dv-three-map-canvas .three-district-label {
  color: #fff;
  font-size: 12px;
}
</style>
