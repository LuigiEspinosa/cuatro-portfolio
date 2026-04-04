'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleWave } from '@/components/atoms/ParticleWave/ParticleWave';

const Scene = dynamic(() => import('@/components/atoms/Scene/Scene').then((m) => m.Scene), {
  ssr: false,
});

const GemComponent = () => {
  // null = not yet checked (avoids fallback flash on capable devices)
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    setWebglAvailable(!!ctx);
  }, []);

  if (webglAvailable === false) {
    return (
      <div id='gem-canvas'>
        {/* Static screenshort shown on devices without WebGL support */}
        <img src='/assets/home/gem-fallback.png' alt='' aria-hidden='true' />
      </div>
    );
  }

  return (
    <div id='gem-canvas'>
      <Scene>
        <ParticleWave />
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} intensity={0.55} radius={0.4} mipmapBlur />
        </EffectComposer>
      </Scene>
    </div>
  );
};

export default GemComponent;
