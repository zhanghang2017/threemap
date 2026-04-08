import * as THREE from "three";
import defaultImage from "@/assets/images/foundation.png";
import type { MapConfig } from "../types";

interface FoundationOptions {
  show: boolean;
  size: number;
  speed: number;
  image: string;
}

interface FoundationMesh extends THREE.Mesh {
  _speed: number;
  _type: string;
}

export const drawFoundation = function (options: FoundationOptions | undefined, config: MapConfig): FoundationMesh | null {
  if (!options) return null;
  let foundation: FoundationMesh | null = null;
  let { show, size, speed, image } = options;
  const { scale } = config;

  if (show && image) {
    if (image === "default") {
      image = defaultImage;
    }
    const texture = new THREE.TextureLoader().load(image);
    const planeGeometry = new THREE.PlaneGeometry(size / scale, size / scale);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    foundation = new THREE.Mesh(planeGeometry, material) as FoundationMesh;
    foundation.rotation.x = -0.5 * Math.PI;
    foundation._speed = speed / scale;
    foundation._type = "foundation";
  }
  return foundation;
};
