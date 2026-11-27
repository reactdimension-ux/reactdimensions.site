# Lollipop Chart

**Group:** Comparing categories

## What it shows
A bar reduced to a thin stem with a dot at the end.

## Best for
Many categories where heavy bars would feel cluttered.

## Avoid when
You need to show parts that stack.

## Data it needs
Category + value.

## Variants
Horizontal, vertical, with a baseline other than zero.

## Suggested props (React Dimensions component)
`data, orientation, dotSize, stemWidth, sort, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
