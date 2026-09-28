import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { Scene } from '../Scene';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid='canvas' className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  PerformanceMonitor: () => null,
}));

describe('Scene', () => {
  it('renders children inside the canvas', () => {
    render(
      <Scene>
        <span data-testid='child'>child</span>
      </Scene>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies className to the canvas', () => {
    render(<Scene className='test-class'>child</Scene>);
    expect(screen.getByTestId('canvas')).toHaveClass('test-class');
  });
});
