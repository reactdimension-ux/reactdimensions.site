# Correlation Matrix

**Group:** Relationships

## What it shows
A heatmap of how every variable relates to every other.

## Best for
Finding which variables move together.

## Avoid when
Only two variables.

## Data it needs
Matrix of correlations or raw columns.

## Variants
Full, lower triangle, circle size, clustered.

## Suggested props (React Dimensions component)
`matrix, labels, triangle, showValues, colorScale`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
