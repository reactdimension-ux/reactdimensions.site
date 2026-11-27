# Parallel Coordinates

**Group:** Other

## What it shows
One vertical axis per variable; each item is a polyline.

## Best for
Exploring many numeric variables at once.

## Avoid when
Few items or few variables.

## Data it needs
Rows with several numeric columns.

## Variants
Brushing on axes, coloured by group.

## Suggested props (React Dimensions component)
`data, dimensions, colorBy, brush, opacity`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
