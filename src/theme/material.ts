import { alpha, mix } from './color';
import type { MaterialKind, Palette, SurfaceTokens } from './types';

const MATERIALS = {
  glass: { label: 'Kính trong', light: '#ffffff', controlBlur: 42, panelBlur: 34, sheen: 0.18, reflection: 0.35 },
  frost: { label: 'Kính băng', light: '#d8fff5', controlBlur: 52, panelBlur: 42, sheen: 0.26, reflection: 0.22 },
  haunted: { label: 'Tím khói', light: '#ba9ce8', controlBlur: 18, panelBlur: 16, sheen: 0.14, reflection: 0.1 },
  lacquer: { label: 'Sơn mài đỏ', light: '#ffda75', controlBlur: 0, panelBlur: 0, sheen: 0.16, reflection: 0.12 },
  gilded: { label: 'Kim loại vàng', light: '#ffe5a5', controlBlur: 8, panelBlur: 6, sheen: 0.21, reflection: 0.18 },
} as const;

export function createMaterial(kind: MaterialKind, colors: Palette): SurfaceTokens {
  const spec = MATERIALS[kind];
  const actionBase = kind === 'gilded' ? colors.accent : colors.primary;
  return {
    kind,
    label: spec.label,
    controlBlur: spec.controlBlur,
    panelBlur: spec.panelBlur,
    controlSheen: [alpha(spec.light, 0.15), alpha(spec.light, 0.025), alpha(spec.light, 0)],
    panelSheen: [alpha(spec.light, 0.075), alpha(spec.light, 0.012), alpha(spec.light, 0)],
    panelEdge: [alpha(spec.light, 0.24), alpha(spec.light, 0.07), alpha(spec.light, 0.12)],
    sheen: [alpha(spec.light, spec.sheen), alpha(colors.card, 0), alpha(colors.panelSolid, kind === 'glass' ? 0.72 : 0.84)],
    activeSheen: [alpha(spec.light, spec.reflection), alpha(spec.light, 0)],
    artworkShade: [alpha(spec.light, 0.12), alpha(colors.panelSolid, 0.08), alpha(colors.panelSolid, 0.5), alpha(colors.panelSolid, 0.97)],
    rim: [alpha(spec.light, 0.55), alpha(spec.light, 0.12), alpha(spec.light, 0)],
    frame: kind === 'glass'
      ? [colors.accentGlow, colors.accent, colors.primary]
      : [spec.light, colors.accent, mix(colors.card, spec.light, 0.22)],
    focusInner: alpha(spec.light, kind === 'glass' ? 0.58 : 0.88),
    textureColor: spec.light,
    textureOpacity: kind === 'glass' ? 0 : kind === 'haunted' ? 0.07 : 0.055,
    actionFill: [mix(actionBase, spec.light, 0.1), actionBase, mix(actionBase, '#000000', 0.28)],
    actionRim: alpha(spec.light, 0.68),
    actionInk: kind === 'haunted' || kind === 'gilded' ? colors.onAccent : colors.white,
  };
}
