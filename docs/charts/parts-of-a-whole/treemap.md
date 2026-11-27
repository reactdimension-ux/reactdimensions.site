# Treemap

**Group:** Parts of a whole

## What it shows
Nested rectangles whose area is proportional to value.

## Best for
Hierarchies with many parts (disk usage, portfolios).

## Avoid when
Precise comparison between close values.

## Data it needs
Hierarchy with a number at the leaves.

## Variants
Squarified, slice-and-dice, drill-down.

## Suggested props (React Dimensions component)
`data, tile, padding, labels, colorBy, onZoom`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
