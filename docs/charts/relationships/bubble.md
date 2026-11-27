# Bubble Chart

**Group:** Relationships

## What it shows
A scatter plot where dot area encodes a third number.

## Best for
Three variables at once (e.g. GDP vs life expectancy vs population).

## Avoid when
Sizes are similar or the data is dense.

## Data it needs
x, y, size per item (+ group).

## Variants
Packed bubbles (no axes), animated over time.

## Suggested props (React Dimensions component)
`points, sizeKey, minR, maxR, colorBy, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
