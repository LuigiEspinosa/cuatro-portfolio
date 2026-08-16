import { render, screen } from '@testing-library/react';
import HudLabel from '../HudLabel';

describe('HudLabel', () => {
  it('renders the label text', () => {
    render(<HudLabel label='// SYS_ONLINE' />);
    expect(screen.getByText('// SYS_ONLINE')).toBeInTheDocument();
  });

  it('renders optional sub text when provided', () => {
    render(<HudLabel label='NAV' sub='ナビゲーション' />);
    expect(screen.getByText('ナビゲーション')).toBeInTheDocument();
  });

  it('does not render sub element when sub is omitted', () => {
    const { container } = render(<HudLabel label='NAV' />);
    expect(container.querySelector('.hud-label_sub')).not.toBeInTheDocument();
  });

  it('applies left alignment class by default', () => {
    const { container } = render(<HudLabel label='NAV' />);
    expect(container.querySelector('.hud-label--left')).toBeInTheDocument();
  });

  it('applies right alignment class when align is right', () => {
    const { container } = render(<HudLabel label='NAV' align='right' />);
    expect(container.querySelector('.hud-label--right')).toBeInTheDocument();
  });

  it('marks the sub element as aria-hiddne', () => {
    const { container } = render(<HudLabel label='NAV' sub='ナビゲーション' />);
    const sub = container.querySelector('.hud-label__sub');
    expect(sub).toHaveAttribute('aria-hidden', 'true');
  });
});
