# Scatter Plot

**Group:** Relationships

## What it shows
One dot per item at (x, y).

## Best for
Correlation, clusters and outliers between two numbers.

## Avoid when
One variable is categorical.

## Data it needs
Two numbers per item (+ optional group).

## Variants
With trend line, grouped colours, labelled points, brush selection.

## Suggested props (React Dimensions component)
`points, xKey, yKey, trendline, colorBy, pointSize, tooltip`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
