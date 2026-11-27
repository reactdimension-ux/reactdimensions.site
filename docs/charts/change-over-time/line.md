# Line Chart

**Group:** Change over time

## What it shows
Points connected in order, usually along a time axis.

## Best for
Trends and comparing a few series over time.

## Avoid when
Categories with no order, or very few points (use bars).

## Data it needs
x (time/number) + y per series.

## Variants
Smooth vs straight, multi-series, with markers, dashed forecast, gradient stroke.

## Suggested props (React Dimensions component)
`data, series, curve, markers, strokeWidth, grid, tooltip, drawOnLoad, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
