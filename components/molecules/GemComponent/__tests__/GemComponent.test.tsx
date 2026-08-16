import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import GemComponent from '../GemComponent';

// Mock the dynamic import so the test does not require a WebGL context
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockScene = () => <div data-testid='scene' />;
    MockScene.displayName = 'MockScene';
    return MockScene;
  },
}));

vi.mock('@/components/atoms/Gem/Gem', () => ({
  Gem: () => <div data-testid='gem' />,
}));

vi.mock('@react-three/drei', () => ({
  Sparkles: () => null,
  OrbitControls: () => null,
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Bloom: () => null,
}));

// jsdom has no WebGl. Return a truhty context so the component renders the
// Schene path instead of the static fallback image.
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({} as WebGLRenderingContext);
});

describe('GemComponent', () => {
  it('renders the gem canvas container', () => {
    render(<GemComponent />);
    expect(document.getElementById('gem-canvas')).toBeInTheDocument();
  });

  it('renders the Scene', () => {
    render(<GemComponent />);
    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });
});
