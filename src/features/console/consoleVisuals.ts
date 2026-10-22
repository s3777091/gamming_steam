/** Shared visual language for Games, Store, PC and their related controls. */
export const CONSOLE = {
  background: '#060b08',
  panel: '#0e1913',
  card: '#14221a',
  navigation: 'rgba(12, 31, 23, 0.82)',
  navigationSelected: 'rgba(49, 91, 65, 0.64)',
  navigationBorder: 'rgba(148, 190, 162, 0.18)',
  navigationSelectedBorder: 'rgba(148, 190, 162, 0.42)',
  control: 'rgba(12, 18, 15, 0.65)',
  border: 'rgba(255, 255, 255, 0.14)',
  selectedBorder: 'rgba(224, 242, 229, 0.72)',
  action: '#c52e32',
  actionBorder: '#e56160',
  ink: '#ffffff',
  muted: 'rgba(255, 255, 255, 0.68)',
  controllerA: '#69cc8c',
  controllerB: '#f07b77',
  backdropMs: 300,
  focusMs: 150,
  scrollMs: 220,
  infoMs: 180,
  hoverMs: 120,
} as const;

export const CONSOLE_CARD = { width: 124, height: 69.75, radius: 10, railHeight: 94 } as const;
