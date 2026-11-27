# Radar / Spider Chart

**Group:** Comparing categories

## What it shows
Several metrics for one or more items on spokes around a centre.

## Best for
Profiles of a few items across 5-8 metrics (skills, stats).

## Avoid when
More than ~3 series, or metrics are on different scales without normalising.

## Data it needs
Metric names + value per series, all on a common scale.

## Variants
Filled, outline only, multiple series.

## Suggested props (React Dimensions component)
`axes, series, max, levels, filled, dotSize, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
