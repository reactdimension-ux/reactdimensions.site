# Heatmap

**Group:** Relationships

## What it shows
A grid of cells coloured by value.

## Best for
Patterns across two categorical axes (hour x day).

## Avoid when
Exact values matter more than patterns.

## Data it needs
Row, column, value.

## Variants
Calendar heatmap, clustered, diverging scale.

## Suggested props (React Dimensions component)
`data, colorScale, cellRadius, showValues, legend`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
