'use client';

import { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import {
  Color,
  EquirectangularReflectionMapping,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Texture,
} from 'three';
import { GLTFLoader, RGBELoader } from 'three/examples/jsm/Addons.js';

const Gem = () => {
  const [gem, setGem] = useState<Mesh | null>(null);
  const [ready, setReady] = useState(false);

  const gemRef = useRef<Group>(null!);
  const hdrDarkRef = useRef<Texture | null>(null);

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const hdrLoader = new RGBELoader();

    const loadGem = async () => {
      const hdrDark = await hdrLoader.loadAsync('/assets/home/environment_D.hdr');

      hdrDark.mapping = EquirectangularReflectionMapping;
      hdrDarkRef.current = hdrDark;

      gltfLoader.load('/assets/home/gem.glb', (gltf) => {
        const gemModel = gltf.scene.children[0] as Mesh;
        gemModel.material = new MeshPhysicalMaterial();
        gemModel.scale.set(1, 1, 1);
        gemModel.rotation.z = -0.4;
        setGem(gemModel);
        setReady(true);
      });
    };

    loadGem();
  }, []);

  useFrame(() => {
    if (gem && hdrDarkRef.current) {
      const material = gem.material as MeshPhysicalMaterial;

      material.color = new Color(0x000000);
      material.metalness = 0;
      material.roughness = 0;
      material.transmission = 0.82;
      material.thickness = 5.1;
      material.envMap = hdrDarkRef.current;
      material.envMapIntensity = 0.3;
      material.specularIntensity = 0.61;
      material.specularColor = new Color(0x000000);
      material.sheen = 0.78;
      material.clearcoat = 0.16;
      material.flatShading = true;

      if (material.isMeshPhysicalMaterial) {
        material.color = new Color(0x000000);
      }

      gem.rotation.y += 0.004;
    }
  });

  if (!ready || !gem) return null;

  return (
    <group ref={gemRef}>
      <primitive object={gem} />
    </group>
  );
};

const GemComponent = () => (
  <div id='gem-canvas'>
    <Canvas camera={{ position: [100, 100, 100] }} shadows>
      <ambientLight intensity={0.2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <Gem />
      <OrbitControls />
    </Canvas>
  </div>
);

export default GemComponent;
