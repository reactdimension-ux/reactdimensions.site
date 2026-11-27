# Density / Ridgeline Plot

**Group:** Distribution

## What it shows
Smoothed distributions stacked with slight overlap.

## Best for
Comparing many distributions (a joy-plot).

## Avoid when
Few groups where a single density plot suffices.

## Data it needs
Raw numbers per group.

## Variants
Single density, ridgeline, filled gradient.

## Suggested props (React Dimensions component)
`groups, bandwidth, overlap, fill, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
