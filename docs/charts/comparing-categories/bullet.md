# Bullet Chart

**Group:** Comparing categories

## What it shows
One value drawn as a bar against a target marker and qualitative ranges.

## Best for
Dashboards: actual vs target in a small space.

## Avoid when
No meaningful target or ranges.

## Data it needs
Actual, target, optional range thresholds.

## Variants
Horizontal, vertical, stacked list of several.

## Suggested props (React Dimensions component)
`value, target, ranges, orientation, label, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
