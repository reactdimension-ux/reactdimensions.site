# Violin Plot

**Group:** Distribution

## What it shows
A box plot with a mirrored density shape on each side.

## Best for
Showing shape (bimodal etc.) as well as spread.

## Avoid when
Small samples where density is misleading.

## Data it needs
Raw numbers per group.

## Variants
Split violin, with inner box, with points.

## Suggested props (React Dimensions component)
`groups, bandwidth, inner, orientation, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
