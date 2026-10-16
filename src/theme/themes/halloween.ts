import { createTheme } from '../createTheme';

// Halloween: nền tím đêm, cam bí ngô làm màu nhấn.
export const halloweenTheme = createTheme({
  id: 'halloween',
  label: 'Halloween',
  material: 'haunted',
  detail: 'Cam bí ngô trên nền tím đêm',
  decor: {
    particles: 'embers',
    ambience: 'fog',
    season: { glyph: 'ghost', greeting: 'Halloween vui vẻ' },
  },
  seed: {
    bg: '#180d24',
    bgDeep: '#0f0718',
    panel: '#24143a',
    panelSolid: '#1d1030',
    card: '#2a1842',
    cardRaised: '#352052',
    keyboardBg: '#1b0f2a',
    accent: '#ff8c1a',
    accentSoft: '#ffab52',
    accentGlow: '#ffc285',
    primary: '#e8650a',
    primaryHover: '#ff7a1f',
    onAccent: '#1f0d00',
    shade: '#150a21',
  },
});
