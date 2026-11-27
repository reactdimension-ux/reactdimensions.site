# Gauge / Meter

**Group:** Single values and progress

## What it shows
One value on a dial between a min and a max.

## Best for
A single KPI against a known range (speed, score, confidence).

## Avoid when
Several values or a trend.

## Data it needs
One number + range + optional zones.

## Variants
Semi-circle, three-quarter, speedometer needle, zones.

## Suggested props (React Dimensions component)
`value, min, max, zones, needle, label, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
