# Area / Stacked Area Chart

**Group:** Change over time

## What it shows
A line chart with the space under it filled.

## Best for
Volume over time, or how parts add up to a total over time.

## Avoid when
Series overlap heavily and hide one another (use lines or transparency).

## Data it needs
x + y per series.

## Variants
Single, overlapping, stacked, 100% stacked, gradient fill.

## Suggested props (React Dimensions component)
`data, series, stacked, normalize, curve, opacity, gradient, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
