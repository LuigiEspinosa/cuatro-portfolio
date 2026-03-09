'use client';

import { useEffect, useState } from 'react';
import { Color, EquirectangularReflectionMapping, Mesh, MeshPhysicalMaterial } from 'three';
import { GLTFLoader, HDRLoader } from 'three/examples/jsm/Addons.js';

export function Gem() {
  const [mesh, setMesh] = useState<Mesh | null>(null);

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const hdrLoader = new HDRLoader();
    let disposed = false;

    const load = async () => {
      const hdr = await hdrLoader.loadAsync('/assets/home/environment_D.hdr');
      hdr.mapping = EquirectangularReflectionMapping;

      gltfLoader.load('/assets/home/gem.glb', (gltf) => {
        if (disposed) return;

        const m = gltf.scene.children[0] as Mesh;
        m.scale.set(0.014, 0.014, 0.014);
        m.rotation.z = -0.4;

        m.material = new MeshPhysicalMaterial({
          color: new Color(0x000000),
          metalness: 0,
          roughness: 0,
          transmission: 0.82,
          thickness: 5.1,
          envMap: hdr,
          envMapIntensity: 0.3,
          specularIntensity: 0.61,
          specularColor: new Color(0x000000),
          sheen: 0.78,
          clearcoat: 0.16,
          flatShading: true,
        });

        setMesh(m);
      });
    };

    load();

    return () => {
      disposed = true;
      // Free GPU memory on unmount so hot-reloads and route navigations do not leak
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as MeshPhysicalMaterial).dispose();
      }
    };
  }, []);

  if (!mesh) return null;

  return (
    <group>
      <primitive object={mesh} />
    </group>
  );
}
