'use client';

import dynamic from 'next/dynamic';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Gem } from '@/components/atoms/Gem/Gem';
import { GemOrbitControls } from '@/components/atoms/GemOrbitControls/GemOrbitControls';

const Scene = dynamic(() => import('@/components/atoms/Scene/Scene').then((m) => m.Scene), {
  ssr: false,
});

const GemComponent = () => (
  <div id='gem-canvas'>
    <Scene>
      <ambientLight intensity={0.2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <Gem />
      <Sparkles count={80} scale={4} size={1.5} speed={0.3} opacity={0.6} />
      <GemOrbitControls />
      <EffectComposer>
        <Bloom luminanceThreshold={0.85} intensity={0.4} radius={0.3} mipmapBlur />
      </EffectComposer>
    </Scene>
  </div>
);

export default GemComponent;
