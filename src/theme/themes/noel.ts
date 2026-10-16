import { createTheme } from '../createTheme';

// Giáng sinh: nền xanh thông đêm, nút đỏ Noel, điểm nhấn đỏ ấm.
export const noelTheme = createTheme({
  id: 'noel',
  label: 'Noel',
  detail: 'Đỏ Giáng sinh trên nền xanh thông',
  decor: { particles: 'snow', ambience: 'frost' },
  seed: {
    bg: '#06190f',
    bgDeep: '#03100a',
    panel: '#0b271a',
    panelSolid: '#081f14',
    card: '#0f3021',
    cardRaised: '#163d2b',
    keyboardBg: '#071c12',
    accent: '#ff6b6b',
    accentSoft: '#ff9494',
    accentGlow: '#ffb0b0',
    primary: '#d62839',
    primaryHover: '#e63946',
    onAccent: '#1f0508',
    shade: '#04150c',
  },
});
