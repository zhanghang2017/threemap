import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import * as THREE from "three";
import type { MapConfig } from "../types";

export const drawMirror = function (innerWidth: number, innerHeight: number, config: MapConfig): Reflector {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const mirror = new Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: innerWidth,
    textureHeight: innerHeight,
    color: 0x889999,
  });
  const { scale } = config;
  const z = 1 / scale;
  mirror.position.y = -z;
  mirror.rotation.x = -0.5 * Math.PI;
  return mirror;
};

export const drawGradientPlane = function (color: [string, string]): THREE.Mesh {
  const plane4 = new THREE.PlaneGeometry(600, 600);
  const material4 = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material4.onBeforeCompile = (shader) => {
    shader.uniforms = {
      ...shader.uniforms,
      center: { value: new THREE.Vector2(0.5, 0.5) },
      radius: { value: 0.25 },
      color1: { value: new THREE.Color(color[0]) },
      color2: { value: new THREE.Color(color[1]) },
      opacitys: { value: 0.5 },
    };
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `
            varying vec2 vUv;
            void main() {
              vUv = uv;
          `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `
              varying vec2 vUv;
              uniform vec2 center;
              uniform float radius;
              uniform vec3 color1;
              uniform vec3 color2;
              uniform float opacitys;
              void main() {
          `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
              float dist = distance(vUv, center);
              float alpha = smoothstep(radius, radius - 0.3, dist); 
              vec3 color = mix(color1, color2, alpha);
              gl_FragColor = vec4(color, opacitys);
              #include <dithering_fragment>
          `,
    );
  };
  const gradientPlane = new THREE.Mesh(plane4, material4);
  gradientPlane.position.set(0, 0.01, 100);
  gradientPlane.rotation.x = -0.5 * Math.PI;
  return gradientPlane;
};
