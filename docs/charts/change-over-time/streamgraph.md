# Streamgraph

**Group:** Change over time

## What it shows
A stacked area centred on a wiggling baseline so layers flow.

## Best for
Showing how many categories rise and fall over time, for looks and overview.

## Avoid when
Readers must read exact values.

## Data it needs
x + y per layer.

## Variants
Centred, silhouette, ordered by peak.

## Suggested props (React Dimensions component)
`data, offset, order, curve, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
