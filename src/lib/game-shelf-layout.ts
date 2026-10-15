export type ShelfMetrics = {
  idleWidth: number;
  activeWidth: number;
  gap: number;
  dividerWidth: number;
  padding: number;
};

/** Include the divider and gaps in each cell so virtual spacers stay exact. */
export function shelfItemLayout(
  index: number,
  selectedIndex: number,
  dividerIndex: number | null,
  metrics: ShelfMetrics,
) {
  const { idleWidth, activeWidth, gap, dividerWidth, padding } = metrics;
  const dividerSpace = dividerWidth + gap;
  return {
    index,
    length: (index === selectedIndex ? activeWidth : idleWidth) + gap
      + (index === dividerIndex ? dividerSpace : 0),
    offset: padding + index * (idleWidth + gap)
      + (index > selectedIndex ? activeWidth - idleWidth : 0)
      + (dividerIndex !== null && index > dividerIndex ? dividerSpace : 0),
  };
}
