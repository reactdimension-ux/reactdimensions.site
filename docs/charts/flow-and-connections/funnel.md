# Funnel Chart

**Group:** Flow and connections

## What it shows
Stages narrowing in width as items drop off.

## Best for
Conversion and drop-off through a sequence.

## Avoid when
Stages are not sequential.

## Data it needs
Stage + count.

## Variants
Centered, left-aligned bars, with conversion %.

## Suggested props (React Dimensions component)
`stages, showConversion, align, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
