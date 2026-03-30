import './hud-label.scss';

interface HubLabelProps {
  label: string;
  sub?: string;
  align?: 'left' | 'right';
}

export const HudLabel = ({ label, sub, align = 'left' }: HubLabelProps) => (
  <div className={`hud-label hud-label--${align}`}>
    <span className='hud-label__text'>{label}</span>
    {sub && (
      <span className='hud-label__sub' aria-hidden='true'>
        {sub}
      </span>
    )}
  </div>
);
