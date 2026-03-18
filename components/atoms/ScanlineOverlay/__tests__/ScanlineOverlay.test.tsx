import { render } from '@testing-library/react';
import ScanlineOverlay from '../ScanlineOverlay';

describe('ScanlineOverlay', () => {
  it('renders without crashing', () => {
    const { container } = render(<ScanlineOverlay />);
    expect(container.querySelector('.scanline-overlay')).toBeInTheDocument();
  });

  it('has aria-hidden to exclude from screan readers', () => {
    const { container } = render(<ScanlineOverlay />);
    expect(container.querySelector('.scanline-overlay')).toHaveAttribute('aria-hidden', 'true');
  });

  it('contains no interactive elements', () => {
    const { queryAllByRole } = render(<ScanlineOverlay />);
    expect(queryAllByRole('button')).toHaveLength(0);
    expect(queryAllByRole('link')).toHaveLength(0);
  });
});
