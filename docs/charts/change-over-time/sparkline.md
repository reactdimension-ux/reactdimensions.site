# Sparkline

**Group:** Change over time

## What it shows
A tiny line or bar trend with no axes or labels.

## Best for
Inline trends in tables, cards and stat tiles.

## Avoid when
Readers need exact values.

## Data it needs
A short array of numbers.

## Variants
Line, area, bars, win/loss, with end dot and min/max marks.

## Suggested props (React Dimensions component)
`values, type, width, height, color, showEnd, showMinMax, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
