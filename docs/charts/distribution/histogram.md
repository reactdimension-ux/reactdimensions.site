# Histogram

**Group:** Distribution

## What it shows
Counts of values in equal-width ranges (bins).

## Best for
Seeing the shape of one numeric variable.

## Avoid when
Categories (use a bar chart).

## Data it needs
Raw numbers; bins are computed.

## Variants
Fixed bins, auto bins, cumulative, overlaid groups.

## Suggested props (React Dimensions component)
`values, bins, cumulative, density, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
