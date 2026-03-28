'use client';

import dynamic from 'next/dynamic';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleWave } from '@/components/atoms/ParticleWave/ParticleWave';

const Scene = dynamic(() => import('@/components/atoms/Scene/Scene').then((m) => m.Scene), {
  ssr: false,
});

const GemComponent = () => (
  <div id='gem-canvas'>
    <Scene>
      <ParticleWave />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} intensity={0.55} radius={0.4} mipmapBlur />
      </EffectComposer>
    </Scene>
  </div>
);

export default GemComponent;
