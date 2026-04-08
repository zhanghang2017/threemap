import * as THREE from "three";

/**
 * 绘制网格辅助线 - 用于调试和坐标参考
 *
 * 使用 THREE.GridHelper 创建一个中心对齐的方格网格
 *
 * @param options - 网格配置 { show, color, opacity }
 * @returns THREE.GridHelper 对象或 null
 */
export const drawGrid = function (options: { show: boolean; color: string; opacity: number }): THREE.GridHelper | null {
  let grid: THREE.GridHelper | null = null;
  if (options.show) {
    // GridHelper(大小, 分段数, 中心线颜色, 网格颜色)
    grid = new THREE.GridHelper(100, 200, options.color, options.color);
    (grid.material as THREE.Material).opacity = options.opacity;
    (grid.material as THREE.Material).transparent = true;
    grid.position.set(0, 0, 0); // 中心对齐
  }
  return grid;
};
