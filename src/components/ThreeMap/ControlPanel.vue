<script setup lang="ts">
import { ref, computed } from "vue";
import type { ThreeMapOptions } from "./types";

type SeriesType = "marker" | "flight" | "prism" | "scatter" | "cylinder";

const props = defineProps<{
  options: ThreeMapOptions;
  seriesTypeOptions: { name: SeriesType; value: string }[];
}>();

const emit = defineEmits<{
  apply: [];
  "add-series": [type: SeriesType];
  "remove-series": [index: number];
  "regenerate-series": [index: number];
}>();

const panelOpen = ref(true);
const basePanelOpen = ref(true);
const seriesPanelOpen = ref(true);
const newSeriesType = ref<SeriesType>("marker");

const topColorHex = computed({
  get: () => colorToHex(props.options.itemStyle.topColor),
  set: (hex: string) => updateColorByHex("topColor", hex),
});

const sideColorHex = computed({
  get: () => colorToHex(props.options.itemStyle.sideColor),
  set: (hex: string) => updateColorByHex("sideColor", hex),
});

const uColorHex = computed({
  get: () => colorToHex(props.options.itemStyle.uColor),
  set: (hex: string) => updateColorByHex("uColor", hex),
});

const lineColorHex = computed({
  get: () => colorToHex(props.options.lineStyle.color),
  set: (hex: string) => {
    props.options.lineStyle.color = hex;
    emitApply();
  },
});

const outLineColorHex = computed({
  get: () => colorToHex(props.options.outLineStyle.color),
  set: (hex: string) => updateColorByHex("outLineColor", hex),
});

const wallColorHex = computed({
  get: () => colorToHex(props.options.wall.color),
  set: (hex: string) => updateColorByHex("wallColor", hex),
});

const emphasisTopColorHex = computed({
  get: () => colorToHex(props.options.emphasis.topColor),
  set: (hex: string) => updateColorByHex("emphasisTopColor", hex),
});

function emitApply(): void {
  emit("apply");
}

function addSeriesFromPanel(): void {
  emit("add-series", newSeriesType.value);
}

function removeSeries(index: number): void {
  emit("remove-series", index);
}

function regenerateSeriesData(index: number): void {
  emit("regenerate-series", index);
}

function colorToHex(color: string): string {
  const parsed = parseColor(color);
  if (!parsed) return "#ffffff";
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const rHex = hex.slice(0, 1);
      const gHex = hex.slice(1, 2);
      const bHex = hex.slice(2, 3);
      const r = parseInt(rHex + rHex, 16);
      const g = parseInt(gHex + gHex, 16);
      const b = parseInt(bHex + bHex, 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
    return null;
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const items = match[1]!.split(",").map((it) => it.trim());
  if (items.length < 3) return null;
  const r = Number(items[0]);
  const g = Number(items[1]);
  const b = Number(items[2]);
  const a = items[3] !== undefined ? Number(items[3]) : 1;
  if ([r, g, b, a].some((v) => Number.isNaN(v))) return null;
  return { r, g, b, a };
}

function updateColorByHex(target: "topColor" | "sideColor" | "uColor" | "outLineColor" | "wallColor" | "emphasisTopColor", hex: string): void {
  const parsed = parseColor(hex);
  if (!parsed) return;
  const alphaSource =
    target === "topColor"
      ? props.options.itemStyle.topColor
      : target === "sideColor"
        ? props.options.itemStyle.sideColor
        : target === "uColor"
          ? props.options.itemStyle.uColor
          : target === "outLineColor"
            ? props.options.outLineStyle.color
            : target === "wallColor"
              ? props.options.wall.color
              : props.options.emphasis.topColor;

  const alpha = parseColor(alphaSource)?.a ?? 1;
  const rgba = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;

  if (target === "topColor") {
    props.options.itemStyle.topColor = rgba;
  } else if (target === "sideColor") {
    props.options.itemStyle.sideColor = rgba;
  } else if (target === "uColor") {
    props.options.itemStyle.uColor = rgba;
  } else if (target === "outLineColor") {
    props.options.outLineStyle.color = rgba;
  } else if (target === "wallColor") {
    props.options.wall.color = rgba;
  } else {
    props.options.emphasis.topColor = rgba;
  }

  emitApply();
}
</script>

<template>
  <div class="three-control-panel">
    <div class="three-control-header">
      <span>控制面板</span>
      <button class="three-btn" @click="panelOpen = !panelOpen">{{ panelOpen ? "收起" : "展开" }}</button>
    </div>
    <div v-if="panelOpen" class="three-control-body">
      <div class="panel-group">
        <button class="panel-group-header" @click="basePanelOpen = !basePanelOpen">
          <span>基础设置</span>
          <span>{{ basePanelOpen ? "-" : "+" }}</span>
        </button>
        <div v-if="basePanelOpen" class="panel-group-body">
          <div class="panel-item">
            <span class="panel-label">区域颜色:</span>
            <div class="color-input-group">
              <input type="color" v-model="topColorHex" />
            </div>
          </div>
          <div class="panel-item">
            <span class="panel-label">侧边颜色:</span>
            <div class="color-input-group">
              <input type="color" v-model="sideColorHex" />
            </div>
          </div>
          <div class="panel-item">
            <span class="panel-label">侧边动效:</span>
            <div class="color-input-group">
              <input type="color" v-model="uColorHex" />
            </div>
          </div>
          <div class="panel-item">
            <span class="panel-label">区域边线:</span>
            <div class="color-input-group">
              <input type="color" v-model="lineColorHex" />
            </div>
          </div>
          <div class="panel-item">
            <span class="panel-label">边界颜色:</span>
            <div class="color-input-group">
              <input type="color" v-model="outLineColorHex" />
            </div>
          </div>
          <div class="panel-item">
            <span class="panel-label">地图深度:</span>
            <input class="number-input" type="number" v-model.number="props.options.config.depth" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">开启镜面:</span>
            <input type="checkbox" v-model="props.options.mirror.show" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">地区名称:</span>
            <input type="checkbox" v-model="props.options.label.show" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">悬浮效果:</span>
            <input type="checkbox" v-model="props.options.emphasis.show" @change="emitApply" />
          </div>
          <div v-if="props.options.emphasis.show" class="panel-item">
            <span class="panel-label">悬浮颜色:</span>
            <div class="color-input-group">
              <input type="color" v-model="emphasisTopColorHex" />
            </div>
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">开启纹理:</span>
            <input type="checkbox" v-model="props.options.texture.show" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">开启旋转:</span>
            <input type="checkbox" v-model="props.options.autoRotate.autoRotate" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">开启网格:</span>
            <input type="checkbox" v-model="props.options.grid.show" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">开启底图:</span>
            <input type="checkbox" v-model="props.options.foundation.show" @change="emitApply" />
          </div>
          <div class="panel-item toggle">
            <span class="panel-label">电子围栏:</span>
            <input type="checkbox" v-model="props.options.wall.show" @change="emitApply" />
          </div>
          <div v-if="props.options.wall.show" class="panel-item">
            <span class="panel-label">围栏高度:</span>
            <input class="number-input" type="number" v-model.number="props.options.wall.height" @change="emitApply" />
          </div>
          <div v-if="props.options.wall.show" class="panel-item">
            <span class="panel-label">围栏颜色:</span>
            <div class="color-input-group">
              <input type="color" v-model="wallColorHex" />
            </div>
          </div>
        </div>
      </div>

      <div class="panel-group">
        <button class="panel-group-header" @click="seriesPanelOpen = !seriesPanelOpen">
          <span>Series 设置</span>
          <span>{{ seriesPanelOpen ? "-" : "+" }}</span>
        </button>
        <div v-if="seriesPanelOpen" class="panel-group-body">
          <div class="three-control-row">
            <label>新增 series</label>
            <div class="three-inline">
              <select v-model="newSeriesType">
                <option v-for="(option, index) in props.seriesTypeOptions" :key="index" :value="option.name">{{ option.value }}</option>
              </select>
              <button class="three-btn" @click="addSeriesFromPanel">添加</button>
            </div>
          </div>
          <div class="three-series-list">
            <div class="three-series-item" v-for="(item, index) in props.options.series" :key="index">
              <div class="three-series-top">
                <span>{{ props.seriesTypeOptions.find((option) => option.name === item.type)?.value }}</span>
                <button class="three-btn danger" @click="removeSeries(index)">移除</button>
              </div>
              <div class="three-control-row">
                <label>seriesName</label>
                <input v-model="item.seriesName" @change="emitApply" />
              </div>
              <div v-if="item.type === 'flight'" class="series-core-grid">
                <label>速度 <input type="number" step="0.1" v-model.number="(item as any).speed" @change="emitApply" /></label>
                <label>头部大小 <input type="number" step="0.1" v-model.number="(item as any).headSize" @change="emitApply" /></label>
                <label>线条长度 <input type="number" v-model.number="(item as any).flightLen" @change="emitApply" /></label>
                <label>粒子数 <input type="number" v-model.number="(item as any).points" @change="emitApply" /></label>
              </div>
              <div v-else-if="item.type === 'marker'" class="series-core-grid">
                <label>宽 <input type="number" v-model.number="(item as any).symbolSize[0]" @change="emitApply" /></label>
                <label>高 <input type="number" v-model.number="(item as any).symbolSize[1]" @change="emitApply" /></label>
                <label>偏移X <input type="number" step="0.1" v-model.number="(item as any).offset[0]" @change="emitApply" /></label>
                <label>偏移Y <input type="number" step="0.1" v-model.number="(item as any).offset[1]" @change="emitApply" /></label>
              </div>
              <div v-else-if="item.type === 'prism'" class="series-core-grid">
                <label>大小 <input type="number" v-model.number="(item as any).size" @change="emitApply" /></label>
                <label>最大高 <input type="number" v-model.number="(item as any).maxHeight" @change="emitApply" /></label>
                <label>最小高 <input type="number" v-model.number="(item as any).minHeight" @change="emitApply" /></label>
                <label>
                  棱柱类型
                  <select v-model.number="(item as any).prismType" @change="emitApply">
                    <option :value="3">棱柱</option>
                    <option :value="2">圆柱</option>
                    <option :value="1">平面柱</option>
                  </select>
                </label>
              </div>
              <div v-else-if="item.type === 'scatter'" class="series-core-grid">
                <label>点大小 <input type="number" step="0.1" v-model.number="(item as any).spotSize" @change="emitApply" /></label>
                <label>点间距 <input type="number" v-model.number="(item as any).spotSeparate" @change="emitApply" /></label>
                <label>环比例 <input type="number" step="0.1" v-model.number="(item as any).ringRatio" @change="emitApply" /></label>
                <label>环间距 <input type="number" v-model.number="(item as any).ringSeparate" @change="emitApply" /></label>
              </div>
              <div v-else-if="item.type === 'cylinder'" class="series-core-grid">
                <label>
                  类型
                  <select v-model="(item as any).mode" @change="emitApply">
                    <option value="cylinder">圆柱</option>
                    <option value="tower">尖塔</option>
                  </select>
                </label>
                <label>大小 <input type="number" v-model.number="(item as any).size" @change="emitApply" /></label>
                <label>最大高 <input type="number" v-model.number="(item as any).maxHeight" @change="emitApply" /></label>
                <label>最小高 <input type="number" v-model.number="(item as any).minHeight" @change="emitApply" /></label>
                <label>间隔 <input type="number" v-model.number="(item as any).separate" @change="emitApply" /></label>
              </div>
              <button class="three-btn" @click="regenerateSeriesData(index)">重生数据</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.three-control-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 300px;
  max-height: calc(100% - 24px);
  overflow: auto;
  z-index: 12;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(6px);
}

.three-control-header {
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.three-control-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.panel-item.toggle {
  justify-content: space-between;
}

.panel-label {
  min-width: 90px;
  color: rgba(255, 255, 255, 0.95);
}

.color-input-group {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}

.color-input-group input[type="color"] {
  width: 46px;
  min-width: 46px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: transparent;
}

.number-input {
  width: 80px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
}

.panel-group {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  overflow: hidden;
}

.panel-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: none;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.panel-group-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(0, 0, 0, 0.18);
}

.three-control-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.three-control-row input,
.three-control-row select {
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
  outline: none;
}

.three-inline {
  display: flex;
  gap: 6px;
}

.three-inline select {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
}

.three-btn {
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
}

.three-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.three-btn.danger {
  border-color: rgba(255, 100, 100, 0.6);
  color: #ffd0d0;
}

.three-series-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.three-series-item {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(9, 30, 62, 0.9);
  color: #e8f1ff;
}

.three-series-item .three-control-row label,
.three-series-item .series-core-grid label,
.three-series-item .three-series-top span {
  color: #e8f1ff;
}

.three-series-item .three-control-row input,
.three-series-item .series-core-grid input,
.three-series-item .three-control-row select {
  background: rgba(15, 49, 99, 0.95);
  color: #f2f7ff;
  border-color: rgba(160, 193, 240, 0.45);
}

.three-series-item input::placeholder {
  color: rgba(226, 237, 255, 0.7);
}

.three-inline select option {
  background: #0b2a55;
  color: #f2f7ff;
}

.series-core-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.series-core-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.series-core-grid input {
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
}

.three-series-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
</style>
