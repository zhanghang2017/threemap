import * as THREE from "three";
import { geoMercator } from "d3-geo";

import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

import { drawDistrict, districtRender, districtAnimate } from "./utils/drawDistrict";
import { drawOutline } from "./utils/drawOutLine";
import { drawGlow } from "./utils/drawGlow";
import { drawMirror, drawGradientPlane } from "./utils/drawPlane";
import { drawMarker } from "./utils/drawMarker";
import { drawPrism } from "./utils/drawPrism";
import { drawFlight, updateMiniFly } from "./utils/drawFlight";
import { drawScatter } from "./utils/drawScatter";
import { drawCylinder } from "./utils/drawCylinder";

import { addTooltip, tooltipRender } from "./utils/addTooltip";
import { drawGrid } from "./utils/drawGrid";
import { drawFoundation } from "./utils/drawFoundation";

import { register } from "./utils/register";

import { uuid, centerOfMass, bbox, featureCollection } from "./utils/helpers";

import type {
  ThreeMapOptions,
  GeoJsonFeatureCollection,
  GeoJsonProperties,
  MapUniform,
  TooltipInstance,
  CacheModel,
  SeriesOptions,
  MarkerSeriesOptions,
  PrismSeriesOptions,
  FlightSeriesOptions,
  ScatterSeriesOptions,
  CylinderSeriesOptions,
} from "./types";

interface ThreeMapConstructorOptions {
  isDesign?: boolean;
}

export default class ThreeMap {
  el: HTMLElement;
  innerWidth: number;
  innerHeight: number;

  isDesign: boolean;
  isInitCamera: boolean;
  registerList: Map<string, [GeoJsonFeatureCollection, GeoJsonFeatureCollection, ReturnType<typeof geoMercator>]>;
  scene: THREE.Scene | null;
  renderer: THREE.WebGLRenderer | null;
  camera: THREE.PerspectiveCamera | null;
  tooltipDom: HTMLElement;
  tooltip: TooltipInstance | null;

  events: Record<string, ((data: any) => void)[]>;
  mapTextures: (THREE.Texture | null)[];
  projection: any;
  axesHelper: THREE.AxesHelper | null;
  cacheMaterials: Record<string, any>;
  cacheDarkMaterials: Record<string, any>;

  districtData: GeoJsonProperties[];
  seriesGroup: THREE.Group;
  environmentGroup: THREE.Group;
  refresh: boolean;

  scale: number;

  cacheModel: CacheModel | null;

  foundationIns: any[];
  isClear: boolean;

  pointer: THREE.Vector2 | null;
  mouseEvent: MouseEvent | null;

  onPointerMove: (e: MouseEvent) => void;
  onPointerClick: (e: MouseEvent) => void;
  onDblClick: (e: MouseEvent) => void;

  clock: THREE.Clock | null;
  raycaster: THREE.Raycaster | null;
  controls: OrbitControls | null;
  CSS2DRenderer: CSS2DRenderer | null;
  lights: THREE.DirectionalLight[];

  bloomComposer: EffectComposer | null;
  finalComposer: EffectComposer | null;

  options: ThreeMapOptions | null;
  mapKey: string;
  mapUf: MapUniform | undefined;
  pickDistrictMesh: THREE.Intersection | null;
  uvScale?: THREE.Vector2;

  /**
   * ThreeMap 核心实例构造：初始化场景、渲染器、交互控制器和鼠标事件。
   */
  constructor(el: HTMLElement, tooltipDom: HTMLElement, options: ThreeMapConstructorOptions = {}) {
    this.el = el;
    this.innerWidth = el.offsetWidth;
    this.innerHeight = el.offsetHeight;

    this.isDesign = !!options.isDesign;
    this.isInitCamera = false;
    this.registerList = new Map();
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.tooltipDom = tooltipDom;
    this.tooltip = null;

    this.events = {};
    this.mapTextures = [];
    this.projection = null;
    this.axesHelper = null;
    this.cacheMaterials = {};
    this.cacheDarkMaterials = {};

    this.districtData = [];
    this.seriesGroup = new THREE.Group();
    this.environmentGroup = new THREE.Group();
    this.refresh = true;

    this.scale = 1;

    this.cacheModel = {
      modelScale: [],
      modelBox: null,
      code: null,
    };

    this.foundationIns = [];
    this.isClear = false;

    this.pointer = new THREE.Vector2(-100000, -10000);
    this.mouseEvent = null;
    this.options = null;
    this.mapKey = "";
    this.pickDistrictMesh = null;
    this.bloomComposer = null;
    this.finalComposer = null;
    this.controls = null;
    this.CSS2DRenderer = null;
    this.lights = [];
    this.clock = null;
    this.raycaster = null;

    const onPointerMove = (mouseEvent: MouseEvent): void => {
      this.pointer!.x = (mouseEvent.offsetX / this.innerWidth) * 2 - 1;
      this.pointer!.y = -(mouseEvent.offsetY / this.innerHeight) * 2 + 1;
      this.mouseEvent = mouseEvent;
    };
    this.onPointerMove = onPointerMove;

    const onPointerClick = (e: MouseEvent): void => {
      e.stopPropagation();
      e.preventDefault();
      const { raycaster, scene } = this;
      if (!raycaster || !scene) return;
      const intersects = raycaster.intersectObjects(scene.children, true);
      const r = intersects.filter((it: any) => it.object._type === "cylinder" || it.object._type === "district" || it.object._type === "scatter");
      if (r.length) {
        const mesh = r[0]!.object as any;
        const { deriveColor, ...properties } = mesh._privateData;
        if (this.events["click"]) {
          this.events["click"].forEach((cb) => {
            cb(properties);
          });
        }
      }
    };
    this.onPointerClick = onPointerClick;
    this.el.addEventListener("mousemove", this.onPointerMove);
    this.el.addEventListener("mousedown", this.onPointerClick);

    const onDblClick = (e: MouseEvent): void => {
      e.stopPropagation();
      e.preventDefault();
      const { raycaster, scene } = this;
      if (!raycaster || !scene) return;
      const intersects = raycaster.intersectObjects(scene.children, true);
      const r = intersects.filter((it: any) => it.object._type === "cylinder" || it.object._type === "district" || it.object._type === "scatter");
      if (r.length) {
        const mesh = r[0]!.object as any;
        const { deriveColor, ...properties } = mesh._privateData;
        if (this.events["dblclick"]) {
          this.events["dblclick"].forEach((cb) => {
            cb(properties);
          });
        }
      }
    };
    this.onDblClick = onDblClick;
    this.el.addEventListener("dblclick", this.onDblClick);

    this.scene = new THREE.Scene();
    this.scene.add(this.seriesGroup);
    this.scene.add(this.environmentGroup);

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    this.lights = this.setLight();
    this.initCamera();
    this.setRenderer();
    this.setCssRenderer();
    this.addHelper();
    this.setController();
  }

  /**
   * 设置配置项
   */
  setOption(options: ThreeMapOptions, refresh = true): void {
    this.mapKey = uuid();
    this.clearMap();
    this.isClear = false;
    this.seriesGroup = new THREE.Group();
    this.scene!.add(this.seriesGroup);
    this.environmentGroup = new THREE.Group();
    this.scene!.add(this.environmentGroup);
    this.options = options;
    const code = options.map + "";
    const camera = options.camera;
    const { x, y, z } = camera;
    this.setEnvironment(options);
    this.setFoundation(options);

    if ((this.isDesign && !this.isInitCamera) || !this.isDesign) {
      this.setCamera(x, y, z);
    }
    this.isInitCamera = true;

    const { autoRotate, config } = options;
    const { disableRotate = false, disableZoom = false } = config;

    if (autoRotate && this.controls) {
      this.controls.autoRotate = autoRotate.autoRotate;
      this.controls.autoRotateSpeed = autoRotate.autoRotateSpeed;
    }
    if (this.controls) {
      this.controls.enableRotate = !disableRotate;
      this.controls.enableZoom = !disableZoom;
    }

    this.addTooltipLayer();

    if (this.registerList.get(code)) {
      const [boundary, full, projection] = this.registerList.get(code)!;
      this.refresh = refresh;

      if (refresh) {
        this.projection = projection;
        this.scale = 1;
        this.cacheModel = {
          modelScale: [],
          modelBox: null,
          code: code,
        };
      } else {
        try {
          if (code === this.cacheModel!.code) {
            this.scale = 1;
          } else {
            const item = this.cacheModel!.modelScale.find((it) => it.code == code);
            this.scale = item!.scale;
          }
        } catch (error) {
          console.warn(`abstain model failed ${error}`);
          this.refresh = true;
          this.projection = projection;
          this.scale = 1;
        }
      }

      this.drawDistrictArea(options.data, full.features, options);
      this.drawDistrictOutline(boundary.features, options);

      const series = options.series;
      series.forEach((item) => {
        switch (item.type) {
          case "marker":
            this.addMarkerLayer(item as MarkerSeriesOptions);
            break;
          case "prism":
            this.addPrismLayer(item as PrismSeriesOptions);
            break;
          case "flight":
            this.addLinkLayer(item as FlightSeriesOptions);
            break;
          case "scatter":
            this.addSCatterLayer(item as ScatterSeriesOptions);
            break;
          case "cylinder":
            this.addCylinderLayer(item as CylinderSeriesOptions);
            break;
        }
      });
    } else {
      throw Error("请先注册地图: " + code);
    }
  }

  /**
   * 配置场景环境特效（辉光、镜面、渐变底板）。
   */
  setEnvironment(options: ThreeMapOptions): void {
    const { bloomComposer, finalComposer } = drawGlow.call(this as any, options);
    this.bloomComposer = bloomComposer;
    this.finalComposer = finalComposer;
    if (options.mirror.show) {
      const mirror = drawMirror.call(this, this.innerWidth, this.innerHeight, options.config);
      const gradientPlane = drawGradientPlane.call(this, options.mirror.color);
      this.environmentGroup.add(mirror);
      this.environmentGroup.add(gradientPlane);
    }
  }

  /**
   * 设置基础环境元素（网格、底图）。
   */
  setFoundation(options: ThreeMapOptions): void {
    const grid = options.grid;
    const foundation = options.foundation;
    if (grid.show) {
      const gridIns = drawGrid.call(this, grid);
      gridIns && this.environmentGroup.add(gridIns);
    }
    if (foundation && foundation.show) {
      const foundationIns = drawFoundation.call(this, foundation, options.config);
      foundationIns && this.environmentGroup.add(foundationIns);
      this.foundationIns = [foundationIns];
    }
  }

  /**
   * 注册地图
   */
  registerMap(code = "100000", registerCode: string, config: ThreeMapOptions["config"]): Promise<GeoJsonFeatureCollection> {
    code = code.toString();
    registerCode = registerCode.toString();
    return register(code).then(([boundary, full]) => {
      let center = centerOfMass(boundary.features[0]!).geometry.coordinates;
      let scale = 10;

      if (boundary.features[0]) {
        if (config.autoScale) {
          let box = bbox(boundary.features[0]);
          if (code == "100000") {
            box = bbox(featureCollection(full.features));
          }

          const { innerHeight, innerWidth } = this;
          const latDelta = Math.abs(box[1] - box[3]);
          const latProperty = innerHeight / latDelta;

          const lngDelta = Math.abs(box[0] - box[2]);
          const lngProperty = innerWidth / lngDelta;
          const ratio = 550 / Math.max(innerHeight, innerWidth);
          scale = Math.floor(Math.min(lngProperty, latProperty)) * ratio * (config.autoScaleFactor || 1);
        } else {
          scale = config.scale;
        }
      }

      const projection = geoMercator().center(center).scale(scale).translate([0, 0]);
      this.registerList.set(registerCode, [boundary, full, projection]);
      return full;
    });
  }

  /**
   * 创建四向平行光，增强地图立体层次。
   */
  setLight(): THREE.DirectionalLight[] {
    const front = new THREE.DirectionalLight(0xe8eaeb, 0.8);
    front.position.set(0, 15, 25);
    const back = front.clone();
    back.position.set(0, 15, -25);
    const left = front.clone();
    left.position.set(-25, 15, 0);
    const right = front.clone();
    right.position.set(25, 15, 0);

    this.scene!.add(front);
    this.scene!.add(back);
    this.scene!.add(left);
    this.scene!.add(right);

    return [front, back, left, right];
  }

  /**
   * 初始化透视相机默认位置。
   */
  initCamera(): void {
    this.camera = new THREE.PerspectiveCamera(75, this.innerWidth / this.innerHeight, 0.1, 1000);
    this.camera.position.set(1, 5, 5);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * 设置相机位置。
   */
  setCamera(x: number, y: number, z: number): void {
    this.camera && this.camera.position.set(x, y, z);
  }

  /**
   * 获取当前相机位置。
   */
  getCamera(): THREE.Vector3 | undefined {
    if (this.camera) {
      return this.camera.position;
    }
  }

  /**
   * 初始化 WebGLRenderer 并挂载到容器。
   */
  setRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });

    this.renderer.setSize(this.innerWidth, this.innerHeight);
    this.renderer.shadowMap.enabled = true;
    (this.renderer as any).shadowMapSoft = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setAnimationLoop(this.animate.bind(this));
    this.renderer.setClearAlpha(0);
    this.el.appendChild(this.renderer.domElement);
  }

  /**
   * 初始化 CSS2DRenderer，用于标签层渲染。
   */
  setCssRenderer(): void {
    this.CSS2DRenderer = new CSS2DRenderer();
    this.CSS2DRenderer.setSize(this.innerWidth, this.innerHeight);
    this.CSS2DRenderer.domElement.style.position = "absolute";
    this.CSS2DRenderer.domElement.style.top = "0px";
    this.el.appendChild(this.CSS2DRenderer.domElement);
  }

  /**
   * three.js 动画循环入口。
   */
  animate(): void {
    this.render();
  }

  /**
   * 每帧渲染：更新控制器、飞线/散点动画、辉光后处理与交互状态。
   */
  render(): void {
    const { cacheDarkMaterials, cacheMaterials, controls, pointer, camera, raycaster, scene, bloomComposer, finalComposer } = this;
    if (!controls || !pointer || !camera || !raycaster || !scene) return;

    controls.update();
    raycaster.setFromCamera(pointer, camera);

    const flightGroup = this.seriesGroup.children.filter((it: any) => it._category === "flight");
    flightGroup.forEach((group) => {
      updateMiniFly(group.children as any);
    });

    this.CSS2DRenderer!.render(scene, camera);

    scene.traverse((mesh: any) => {
      if (mesh instanceof THREE.Scene) {
        cacheDarkMaterials.scene = mesh.background;
        mesh.background = null;
      }

      const material = mesh.material;
      if (material && !mesh._isGlow && material.type != "ShaderMaterial") {
        cacheMaterials[mesh.uuid] = material;

        if (!cacheDarkMaterials[material.type]) {
          const Proto = Object.getPrototypeOf(material).constructor;
          cacheDarkMaterials[material.type] = new Proto({ color: 0x000000 });
        }
        mesh.material = cacheDarkMaterials[material.type];
      }
    });

    bloomComposer && bloomComposer.render();

    scene.traverse((mesh: any) => {
      if (cacheMaterials[mesh.uuid]) {
        mesh.material = cacheMaterials[mesh.uuid];
        delete cacheMaterials[mesh.uuid];
      }
      if (mesh instanceof THREE.Scene) {
        mesh.background = cacheMaterials.scene;
        delete cacheMaterials.scene;
      }
    });

    finalComposer && finalComposer.render();

    districtRender.call(this as any);
    tooltipRender.call(this as any);

    const scatterGroup = this.seriesGroup.children.filter((it: any) => it._category === "scatter");
    scatterGroup.forEach((group) => {
      group.children.forEach((mesh: any) => {
        const ring = mesh.children[0];
        if (ring) {
          ring._scale += 0.01;
          ring.scale.set(1 * ring._scale, 1 * ring._scale, 1 * ring._scale);
          if (ring._scale <= 2) {
            ring.material.opacity = 2 - ring._scale;
          } else {
            ring._scale = 1;
          }
        }
      });
    });

    this.foundationIns.forEach((mesh: any) => {
      mesh && (mesh.rotation.z -= mesh._speed || 0.003);
    });

    const mapUf = this.mapUf;
    districtAnimate.call(this as any, mapUf);
  }

  /**
   * 绘制行政区边界与电子围栏。
   */
  drawDistrictOutline(features: GeoJsonFeatureCollection["features"], options: ThreeMapOptions): void {
    const { outline, drawWall, wallTexture } = drawOutline.call(this as any, features, options, options.config);
    this.seriesGroup.add(outline);
    this.mapTextures.push(wallTexture);
    drawWall().then((group) => {
      this.seriesGroup && this.seriesGroup.add(group);
    });
  }

  /**
   * 绘制行政区主体（顶面/侧面/标签）并维护缩放缓存模型。
   */
  drawDistrictArea(data: ThreeMapOptions["data"], features: GeoJsonFeatureCollection["features"], options: ThreeMapOptions): void {
    const { meshGroup, advanceMeshGroup, mapUf, districtData, _realShape, mapTexture } = drawDistrict.call(this as any, data, options, features, options.config);
    this.mapTextures.push(mapTexture);
    this.mapUf = mapUf;
    this.districtData = districtData;

    if (!this.refresh) {
      advanceMeshGroup.scale.set(this.scale, 1, this.scale);
      const scaledBox = new THREE.Box3().setFromObject(advanceMeshGroup);
      advanceMeshGroup.scale.set(1, 1, 1);
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);
      this.seriesGroup.position.sub(center);
      this.seriesGroup.scale.set(this.scale, 1, this.scale);

      this.seriesGroup.add(advanceMeshGroup);
      this.seriesGroup.add(meshGroup);
    } else {
      this.seriesGroup.add(advanceMeshGroup);
      this.seriesGroup.add(meshGroup);
    }

    const mapKey = this.mapKey;
    _realShape().then((group) => {
      this.seriesGroup.remove(advanceMeshGroup);

      if (mapKey != this.mapKey) return false;

      const res = group.children;
      this.seriesGroup.add(group);

      if (this.refresh) {
        const modelBox = new THREE.Box3();
        res.forEach((district) => {
          const itemBox = new THREE.Box3().setFromObject(district);
          modelBox.union(itemBox);
        });
        this.cacheModel!.modelBox = modelBox;
      }
      const modelBox = this.cacheModel!.modelBox!;
      const modelScale: { code: string | number; scale: number }[] = [];
      res.forEach((mesh: any) => {
        const code = mesh._privateData.adcode;
        const model = mesh.clone();
        model.scale.set(1, 1, 1);
        const currentModel = new THREE.Box3().setFromObject(model);
        const widthA = modelBox.max.x - modelBox.min.x;
        const heightA = modelBox.max.z - modelBox.min.z;
        const widthB = currentModel.max.x - currentModel.min.x;
        const heightB = currentModel.max.z - currentModel.min.z;
        const widthRatio = widthA / widthB;
        const heightRatio = heightA / heightB;
        const scaleVal = (widthRatio + heightRatio) / 2;
        modelScale.push({ code, scale: scaleVal });
      });
      this.cacheModel!.modelScale.push(...modelScale);
    });
  }

  /**
   * 构建 tooltip 实例并挂到当前地图上下文。
   */
  addTooltipLayer(): void {
    const tooltip = addTooltip.call(this as any, this.options!.tooltip);
    if (tooltip) {
      this.tooltip = tooltip;
      this.tooltip._hide();
    } else {
      this.tooltip = null;
    }
  }

  /**
   * 添加 marker 系列图层。
   */
  addMarkerLayer(options: MarkerSeriesOptions): void {
    const config = this.options!.config;
    const markerGroup = drawMarker.call(this as any, options, config);
    this.seriesGroup.add(markerGroup);
  }

  /**
   * 添加 prism 系列图层。
   */
  addPrismLayer(options: PrismSeriesOptions): void {
    const config = this.options!.config;
    const prismsGroup = drawPrism.call(this as any, options, config);
    this.seriesGroup.add(prismsGroup);
  }

  /**
   * 添加 flight 系列图层。
   */
  addLinkLayer(options: FlightSeriesOptions): void {
    const config = this.options!.config;
    const group = drawFlight.call(this as any, options, config);
    this.seriesGroup.add(group);
  }

  /**
   * 添加 cylinder 系列图层。
   */
  addCylinderLayer(options: CylinderSeriesOptions): void {
    const config = this.options!.config;
    const cylinderGroup = drawCylinder.call(this as any, options, config);
    this.seriesGroup.add(cylinderGroup);
  }

  /**
   * 添加 scatter 系列图层。
   */
  addSCatterLayer(options: ScatterSeriesOptions): void {
    const config = this.options!.config;
    const scatterGroup = drawScatter.call(this as any, options, config);
    this.seriesGroup.add(scatterGroup);
  }

  /**
   * 销毁地图实例及所有三维资源，释放监听器与 GPU 内存。
   */
  destroyMap(): void {
    if (this.el) {
      this.el.removeEventListener("mousemove", this.onPointerMove);
      this.el.removeEventListener("mousedown", this.onPointerClick);
      this.el.removeEventListener("dblclick", this.onDblClick);
    }

    if (Array.isArray(this.mapTextures)) {
      this.mapTextures.forEach((texture) => texture?.dispose && texture.dispose());
      this.mapTextures = [];
    }

    this.lights.forEach((light) => {
      this.scene!.remove(light);
    });
    this.lights = [];
    this.clearMap();
    this.cacheModel = null;

    const cleanObject = (object: any): void => {
      if (!object) return;
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    };

    if (this.scene) {
      this.scene.traverse(cleanObject);
      this.scene.clear();
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      (this.renderer as any).domElement = null;
      this.renderer = null;
    }

    this.CSS2DRenderer && ((this.CSS2DRenderer as any).domElement = null);
    (["bloomComposer", "finalComposer", "axesHelper", "controls"] as const).forEach((key) => {
      const obj = (this as any)[key];
      if (obj && typeof obj.dispose === "function") {
        obj.dispose();
      }
      (this as any)[key] = null;
    });

    this.seriesGroup = null as any;
    this.environmentGroup = null as any;
    this.cacheMaterials = {};
    this.cacheDarkMaterials = {};
    this.clock = null;
    this.raycaster = null;
    this.districtData = [];
    this.el = null as any;
    this.tooltipDom = null as any;
    this.CSS2DRenderer = null;
    this.camera = null;
    this.pointer = null;
  }

  /**
   * 清空当前地图图层并回收 mesh/material/texture 资源。
   */
  clearMap(): void {
    this.isClear = true;
    const environmentGroup = this.environmentGroup;
    environmentGroup.traverse((obj: any) => {
      if (obj.type === "Mesh") {
        obj.geometry.dispose?.();
        obj.material.dispose?.();
        obj.material.map && obj.material.map.dispose();
      }
    });
    if (environmentGroup.children.length) {
      environmentGroup.children = [];
    }
    const seriesGroup = this.seriesGroup;
    seriesGroup.traverse((obj: any) => {
      if (obj.type === "Mesh") {
        obj.geometry.dispose?.();
        obj.material.dispose?.();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((material: any) => {
            material.dispose?.();
            if (material.map) material.map.dispose();
          });
        }
      } else if (["label", "marker", "prism"].includes(obj._type)) {
        obj.element.remove();
      }
    });
    if (seriesGroup.children.length) {
      seriesGroup.children = [];
    }

    this.foundationIns = [];
    this.scene!.remove(this.seriesGroup);
    this.scene!.remove(this.environmentGroup);
  }

  /**
   * 响应容器尺寸变化并同步渲染器与相机参数。
   */
  resize(): void {
    const el = this.el;
    this.innerWidth = el.offsetWidth;
    this.innerHeight = el.offsetHeight;
    this.renderer!.setSize(this.innerWidth, this.innerHeight);
    this.CSS2DRenderer!.setSize(this.innerWidth, this.innerHeight);
    this.camera!.aspect = this.innerWidth / this.innerHeight;
    this.camera!.updateProjectionMatrix();
  }

  /**
   * 添加坐标辅助器（默认长度为 0，可按需调试时放大）。
   */
  addHelper(): void {
    const axesHelper = new THREE.AxesHelper(0);
    axesHelper.layers.enableAll();
    this.axesHelper = axesHelper;
    this.scene!.add(axesHelper);
  }

  /**
   * 初始化轨道控制器并绑定相机变更事件。
   */
  setController(): void {
    const controls = new OrbitControls(this.camera!, this.el);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.2;
    controls.minPolarAngle = 0;
    controls.enablePan = false;
    this.controls = controls;

    this.controls.addEventListener("change", () => {
      const events = this.events["change"];
      events &&
        events.forEach((callback) => {
          callback(this.camera!);
        });
    });
  }

  /**
   * 取消事件监听。
   * @param eventName 传入事件名时仅取消该事件，否则清空全部事件。
   */
  off(eventName?: string): void {
    if (eventName) {
      Reflect.deleteProperty(this.events, eventName);
    } else {
      this.events = {};
    }
  }

  /**
   * 注册事件监听。
   */
  on(eventName: string, cb: (data: any) => void): void {
    if (this.events[eventName]) {
      this.events[eventName].push(cb);
    } else {
      this.events[eventName] = [cb];
    }
  }
}
