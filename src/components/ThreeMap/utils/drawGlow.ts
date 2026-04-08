import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import * as THREE from "three";
import type { ThreeMapContext, ThreeMapOptions } from "../types";

// Vertex Shader: 传递 UV 坐标
const vs = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

// Fragment Shader: 混合基础渲染和 Bloom 效果
const fs = `uniform sampler2D baseTexture;  // 基础渲染结果
uniform sampler2D bloomTexture; // Bloom 效果结果
varying vec2 vUv;
void main() {
vec4 base_color = texture2D(baseTexture, vUv);
vec4 bloom_color = texture2D(bloomTexture, vUv);
// 计算亮度 (人眼感知正确的权重)
float lum = 0.21 * bloom_color.r + 0.71 * bloom_color.g + 0.07 * bloom_color.b;
// 混合 RGB + 保持 Alpha
gl_FragColor = vec4(base_color.rgb + bloom_color.rgb, max(base_color.a, lum));
}`;

/**
 * 创建 Bloom 发光效果处理器
 *
 * 实现原理:
 * 1. bloomComposer: 仅渲染高亮区域 (标记为 _isGlow 的对象)
 *    - RenderPass: 渲染场景
 *    - UnrealBloomPass: 应用 Bloom 效果
 *
 * 2. finalComposer: 混合基础渲染和 Bloom 结果
 *    - RenderPass: 渲染完整场景
 *    - ShaderPass: 将基础渲染 + Bloom 纹理混合
 *    - SMAAPass: 抗锯齿 (提升画质)
 *
 * Bloom 参数:
 * - threshold: 亮度阈值,只有超过该值的像素才会发光
 * - strength: 发光强度
 * - radius: 发光扩散半径
 *
 * @param options - 地图配置对象 (含 glow 属性)
 * @returns { bloomComposer, finalComposer } 两个 Composer 实例
 */
export const drawGlow = function (this: ThreeMapContext, options: ThreeMapOptions): { bloomComposer: EffectComposer; finalComposer: EffectComposer } {
  const glow = options.glow;
  const { scene, camera, renderer, innerWidth, innerHeight } = this;

  // 创建渲染通道
  const renderPass = new RenderPass(scene, camera);

  // 创建 Bloom 通道
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(renderer.domElement.offsetWidth, renderer.domElement.offsetHeight), 1, 1, 0.1);
  bloomPass.threshold = glow.threshold; // 亮度阈值
  bloomPass.strength = glow.strength; // 发光强度
  bloomPass.radius = glow.radius; // 扩散半径

  // Bloom 合成器: 仅渲染高亮区域
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false; // 不直接输出到屏幕
  bloomComposer.addPass(renderPass);
  bloomComposer.addPass(bloomPass);

  // 最终合成器: 混合基础渲染 + Bloom
  const finalComposer = new EffectComposer(renderer);

  // 混合 Shader 通道
  const shaderPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null }, // 基础渲染输入
        bloomTexture: { value: bloomComposer.renderTarget2.texture }, // Bloom 纹理输入
      },
      vertexShader: vs,
      fragmentShader: fs,
      defines: {},
    }),
    "baseTexture",
  );
  shaderPass.needsSwap = true; // 需要交换 render target
  finalComposer.addPass(renderPass);
  finalComposer.addPass(shaderPass);

  // SMAA 抗锯齿通道
  const smaaPass = new SMAAPass();
  finalComposer.addPass(smaaPass);

  return { bloomComposer, finalComposer };
};
