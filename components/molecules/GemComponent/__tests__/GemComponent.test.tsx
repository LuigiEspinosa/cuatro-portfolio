import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import GemComponent from '../GemComponent';

// Mock the dynamic import so the test does not require a WebGL context
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockScene = ({ children }: { children: ReactNode }) => (
      <div data-testid='scene'>{children}</div>
    );
    MockScene.displayName = 'MockScene';
    return MockScene;
  },
}));

vi.mock('@/components/atoms/Gem/Gem', () => ({
  Gem: () => <mesh data-testid='gem' />,
}));

vi.mock('@react-three/drei', () => ({
  Sparkles: () => null,
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Bloom: () => null,
}));

describe('GemComponent', () => {
  it('rendrs the gem canvas container', () => {
    render(<GemComponent />);
    expect(document.getElementById('gem-canvas')).toBeInTheDocument();
  });

  it('renders the Scene', () => {
    render(<GemComponent />);
    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });
});
