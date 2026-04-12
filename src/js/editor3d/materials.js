import * as THREE from "three";

export function createBaseMaterial(colorHex) {
  const color = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.05,
  });
}


export function createMetalMaterial(colorHex) {
  const color = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.85,
  });
}


export function createNeonMaterial(colorHex) {
  const color = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.1,
  });
}