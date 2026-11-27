# Progress Bar / Ring

**Group:** Single values and progress

## What it shows
A bar or circle filled to a percentage.

## Best for
Completion of one task, goal or upload.

## Avoid when
Comparing many items (use a bar chart).

## Data it needs
One percentage.

## Variants
Linear, ring, segmented, striped, indeterminate.

## Suggested props (React Dimensions component)
`value, variant, thickness, label, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
