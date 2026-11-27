# KPI / Stat Tile

**Group:** Single values and progress

## What it shows
A big number, label, change vs before and often a sparkline.

## Best for
The headline numbers on a dashboard.

## Avoid when
No context or comparison.

## Data it needs
Value, previous value, optional series.

## Variants
With delta arrow, with sparkline, counting up.

## Suggested props (React Dimensions component)
`label, value, delta, format, sparkline, trendColors, countUp`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
