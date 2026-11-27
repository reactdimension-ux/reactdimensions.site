# Sunburst Chart

**Group:** Parts of a whole

## What it shows
Concentric rings; each ring is one level of a hierarchy.

## Best for
Seeing proportions across several hierarchy levels.

## Avoid when
Deep hierarchies with tiny slices.

## Data it needs
Hierarchy with values.

## Variants
Full circle, with zoom on click, with centre label.

## Suggested props (React Dimensions component)
`data, rings, innerRadius, onSelect, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
