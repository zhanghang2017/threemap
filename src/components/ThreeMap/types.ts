import type * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

// ==================== GeoJSON ====================

export interface GeoJsonProperties {
  adcode: string | number;
  name: string;
  centroid?: [number, number];
  center?: [number, number];
  seriesName?: string;
  [key: string]: any;
}

export interface GeoJsonGeometry {
  type: "Polygon" | "MultiPolygon" | "Point" | "LineString" | "MultiLineString";
  coordinates: any;
}

export interface GeoJsonFeature {
  type: "Feature";
  properties: GeoJsonProperties;
  geometry: GeoJsonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

// ==================== Label / TextStyle ====================

export interface TextStyle {
  fontSize: number | string;
  color: string;
  fontStyle: string;
  fontWeight: string;
  fontFamily: string;
  textDecoration: string;
  textShadow: string;
  [key: string]: any;
}

export interface LabelItemStyle {
  padding: number[];
  backgroundColor: string;
  borderRadius: number | number[];
  borderColor: string;
  borderWidth: number | string;
  textStyle: TextStyle;
}

export interface LabelOptions {
  show: boolean;
  name: string;
  isFormatter: boolean;
  formatter: ((data: any) => string) | null;
  formatterHtml: string;
  className: string;
  offset: [number, number];
  itemStyle: LabelItemStyle;
}

// ==================== Series ====================

export interface FlightDataItem {
  start: string | number | number[];
  end: string | number | number[];
}

export interface FlightSeriesOptions {
  type: "flight";
  seriesName: string;
  points: number;
  flightLen: number;
  speed: number;
  flightColor: string[];
  headSize: number;
  data: FlightDataItem[];
}

export interface MarkerSeriesOptions {
  type: "marker";
  seriesName: string;
  symbol: string;
  symbolSize: [number, number];
  symbolSizeFormatter: ((data: any[]) => [number, number]) | null;
  offset: [number, number];
  className: string;
  label: LabelOptions;
  data: DataItem[];
}

export interface PrismSeriesOptions {
  type: "prism";
  seriesName: string;
  size: number;
  prismType: 1 | 2 | 3;
  maxHeight: number;
  minHeight: number;
  offset: [number, number];
  className: string;
  label: LabelOptions;
  itemStyle: {
    color: [string, string, string];
  };
  data: DataItem[];
}

export interface ScatterSeriesOptions {
  type: "scatter";
  seriesName: string;
  spotColor: string;
  spotSize: number;
  spotSizeFormatter: ((data: any[]) => number) | null;
  spotSeparate: number;
  ringColor: string;
  ringRatio: number;
  ringSeparate: number;
  offset: [number, number];
  label: LabelOptions;
  data: DataItem[];
}

export interface CylinderSeriesOptions {
  type: "cylinder";
  seriesName: string;
  mode: "cylinder" | "tower";
  towerColor: string;
  color: [string, string];
  size: number;
  maxHeight: number;
  minHeight: number;
  separate: number;
  offset: [number, number];
  label: LabelOptions;
  data: DataItem[];
}

export type SeriesOptions = FlightSeriesOptions | MarkerSeriesOptions | PrismSeriesOptions | ScatterSeriesOptions | CylinderSeriesOptions;

// ==================== Data ====================

export interface DataItem {
  district: string | number | number[];
  name?: string;
  value?: number;
  color?: string | null;
  adcode?: string | number;
  seriesName?: string;
  [key: string]: any;
}

export interface RangeRule {
  value: number;
  color: string;
  label: string;
}

// ==================== Options ====================

export interface MapConfig {
  autoScale: boolean;
  disableRotate: boolean;
  disableZoom: boolean;
  autoScaleFactor: number;
  scale: number;
  depth: number;
}

export interface TooltipItemStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  padding: number[];
  color: string;
  fontSize: number;
  minWidth: number;
  width: string;
  borderRadius: number;
  borderStyle: string;
  [key: string]: any;
}

export interface TooltipOptions {
  show: boolean;
  content: string;
  styleType: string;
  isFormatter: boolean;
  formatterHtml: string;
  formatter: ((data: any) => string) | null;
  itemStyle: TooltipItemStyle;
}

export interface RangeOptions {
  show: boolean;
  mode: "range" | "separate";
  rules: RangeRule[];
  color: string[];
  min: number;
  max: number;
  visualMap: {
    show: boolean;
    left: string;
    top: string;
    maxText: string;
    minText: string;
    textStyle: TextStyle;
  };
}

export interface ThreeMapOptions {
  config: MapConfig;
  autoRotate: {
    autoRotate: boolean;
    autoRotateSpeed: number;
  };
  camera: {
    x: number;
    y: number;
    z: number;
  };
  grid: {
    show: boolean;
    color: string;
    opacity: number;
  };
  foundation: {
    show: boolean;
    size: number;
    speed: number;
    image: string;
    isRotate: boolean;
    static: boolean;
  };
  tooltip: TooltipOptions;
  mirror: {
    show: boolean;
    color: [string, string];
  };
  wall: {
    show: boolean;
    height: number;
    color: string;
  };
  texture: {
    show: boolean;
    autoRepeat: boolean;
    repeat: { x: number; y: number };
    offset: { x: number; y: number };
    image: string;
  };
  map: string;
  mapName: string;
  glow: {
    show: boolean;
    threshold: number;
    strength: number;
    radius: number;
  };

  itemStyle: {
    range: RangeOptions;
    topColor: string;
    sideColor: string;
    uColor: string;
  };
  emphasis: {
    show: boolean;
    topColor: string;
    textStyle: TextStyle;
  };
  lineStyle: {
    color: string;
  };
  outLineStyle: {
    color: string;
  };
  label: LabelOptions;
  seriesName: string;
  data: DataItem[];
  series: SeriesOptions[];
}

// ==================== Three.js Extensions ====================

export interface ExtendedMesh extends THREE.Mesh {
  _type?: string;
  _privateData?: any;
  _label?: HTMLElement;
  _isGlow?: boolean;
  _speed?: number;
  _scale?: number;
}

export interface ExtendedObject3D extends THREE.Object3D {
  _type?: string;
  _category?: string;
  _privateData?: any;
  _isGlow?: boolean;
  element?: HTMLElement;
}

export interface ExtendedGroup extends THREE.Group {
  _category?: string;
}

export interface ExtendedPoints extends THREE.Points {
  _speed?: number;
  _repeat?: number;
  _been?: number;
  _total?: number;
  _isHalf?: string | null;
}

export interface MapUniform {
  uTime: { value: number };
  uHeight: { value: number };
  uColor: { value: THREE.Color };
  uStart: { value: number };
  uSpeed: { value: number };
}

export interface TooltipInstance {
  _type: "tooltip";
  _show: (data: any) => void;
  _hide: () => void;
}

export interface CacheModel {
  modelScale: { code: string | number; scale: number }[];
  modelBox: THREE.Box3 | null;
  code: string | null;
}

// ==================== ThreeMap Context ====================

export interface ThreeMapContext {
  projection: (coords: [number, number]) => [number, number];
  districtData: GeoJsonProperties[];
  events: Record<string, ((data: any) => void)[]>;
  scale: number;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  innerWidth: number;
  innerHeight: number;
  tooltipDom: HTMLElement;
  tooltip: TooltipInstance | null;
  pickDistrictMesh: THREE.Intersection | null;
  mouseEvent: MouseEvent | null;
  clock: THREE.Clock;
  refresh: boolean;
  uvScale?: THREE.Vector2;
  isClear: boolean;
  mapUf?: MapUniform;
  [key: string]: any;
}
