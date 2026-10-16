import { createTheme } from '../createTheme';

// Tết Nguyên Đán: nền đỏ trầm, nút đỏ may mắn, điểm nhấn vàng hoa mai.
export const tetTheme = createTheme({
  id: 'tet',
  label: 'Tết',
  detail: 'Đỏ may mắn và vàng hoa mai',
  decor: {
    particles: 'petals',
    ambience: 'lanternGlow',
    season: { glyph: 'blossom', greeting: 'Chúc mừng năm mới' },
  },
  seed: {
    bg: '#220808',
    bgDeep: '#150404',
    panel: '#320f0f',
    panelSolid: '#2a0b0b',
    card: '#3a1414',
    cardRaised: '#481b1b',
    keyboardBg: '#250909',
    accent: '#ffc940',
    accentSoft: '#ffd873',
    accentGlow: '#ffe49e',
    primary: '#d4202c',
    primaryHover: '#e8353f',
    onAccent: '#2a1700',
    shade: '#1d0606',
  },
});
