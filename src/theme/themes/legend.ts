import { createTheme } from '../createTheme';

// Legend: tím hoàng gia và vàng huyền thoại, kiểu vật phẩm hạng "legendary".
export const legendTheme = createTheme({
  id: 'legend',
  label: 'Legend',
  material: 'gilded',
  detail: 'Vàng huyền thoại trên nền tím hoàng gia',
  decor: {
    particles: 'motes',
    ambience: 'goldSheen',
    season: { glyph: 'crown' },
  },
  seed: {
    bg: '#130c28',
    bgDeep: '#0b0719',
    panel: '#1d143c',
    panelSolid: '#171032',
    card: '#231946',
    cardRaised: '#2d2158',
    keyboardBg: '#150e2d',
    accent: '#e8c26a',
    accentSoft: '#f0d48f',
    accentGlow: '#f7e3b0',
    primary: '#7c4dff',
    primaryHover: '#9068ff',
    onAccent: '#1c1404',
    shade: '#110a24',
  },
});
