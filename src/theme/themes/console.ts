import { createTheme } from '../createTheme';

// Theme gốc của console ngang. Lấy từ các class Tailwind của
// src/components/game-library/* bên web (nền #080c12, thẻ #111821, nhấn #66a8ff).
export const consoleTheme = createTheme({
  id: 'console',
  label: 'Console',
  detail: 'Xanh console mặc định',
  seed: {
    bg: '#080c12',
    bgDeep: '#05080d',
    panel: '#0d1520',
    panelSolid: '#0a111c',
    card: '#111821',
    cardRaised: '#18202c',
    keyboardBg: '#0b1018',
    accent: '#66a8ff',
    accentSoft: '#8bbcff',
    accentGlow: '#9ac5ff',
    primary: '#1f6feb',
    primaryHover: '#388bfd',
    onAccent: '#06111f',
    shade: '#070a10',
  },
  // Giữ đúng từng giá trị đã tinh chỉnh tay của bản thiết kế gốc.
  overrides: {
    colors: {
      primaryDeep: '#0a4fb8',
      primaryDark: '#06265f',
      primaryNight: '#020b24',
    },
    glass: {
      controlOverlay: 'rgba(8, 12, 18, 0.08)',
      surfaceRaised: 'rgba(18, 24, 34, 0.78)',
      modal: 'rgba(8, 11, 17, 0.88)',
      panelOverlay: 'rgba(5, 8, 13, 0.70)',
      scrim: 'rgba(2, 4, 8, 0.62)',
      floatingBar: 'rgba(9, 13, 20, 0.82)',
      ambient: 'rgba(31, 111, 235, 0.12)',
      ambientAccent: 'rgba(102, 168, 255, 0.05)',
      backdropTint: 'rgba(31, 111, 235, 0)',
    },
    settings: {
      sidebarBg: 'rgba(10, 16, 26, 0.82)',
      cardRaised: 'rgba(18, 26, 38, 0.75)',
      inset: 'rgba(6, 10, 16, 0.50)',
    },
  },
});
