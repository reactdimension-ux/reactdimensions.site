# Waffle Chart

**Group:** Parts of a whole

## What it shows
A grid of squares (often 10x10) with a share filled in.

## Best for
Showing one percentage in a friendly, countable way.

## Avoid when
Shares need decimals.

## Data it needs
One or more shares of 100.

## Variants
Square, circle cells, multi-category, icon cells.

## Suggested props (React Dimensions component)
`value, rows, cols, shape, gap, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
