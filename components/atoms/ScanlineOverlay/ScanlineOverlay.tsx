import './ScanlineOverlay.scss';

interface ScanlineOverlayProps {
  intensity?: 'light' | 'full';
}

const ScanlineOverlay = ({ intensity = 'full' }: ScanlineOverlayProps) => (
  <div className={`scanline-overlay scanline-overlay__${intensity}`} aria-hidden='true'>
    <span className='scanline-overlay__grain' />
  </div>
);

export default ScanlineOverlay;
