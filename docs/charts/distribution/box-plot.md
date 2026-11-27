# Box Plot

**Group:** Distribution

## What it shows
Median, quartiles, whiskers and outliers.

## Best for
Comparing distributions across groups compactly.

## Avoid when
Audience is unfamiliar and has no legend; very small samples.

## Data it needs
Raw numbers per group (or precomputed stats).

## Variants
Horizontal, notched, with points overlaid.

## Suggested props (React Dimensions component)
`groups, whisker, showOutliers, orientation, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
