# Hexbin / Contour Plot

**Group:** Relationships

## What it shows
Dense scatter aggregated into hexagons or contour lines.

## Best for
Tens of thousands of points where a scatter turns to a blob.

## Avoid when
Few points.

## Data it needs
Two numbers per item.

## Variants
Hexbin, square bin, contour, 2D density.

## Suggested props (React Dimensions component)
`points, binSize, shape, colorScale`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
