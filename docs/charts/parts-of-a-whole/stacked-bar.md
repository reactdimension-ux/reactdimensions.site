# Stacked Bar (Share) Chart

**Group:** Parts of a whole

## What it shows
One bar divided into segments.

## Best for
Parts of a whole when pie slices would be hard to compare; also across several bars.

## Avoid when
You need to compare the middle segments across bars.

## Data it needs
Segment label + value, per bar.

## Variants
Single 100% bar, multiple stacked, horizontal.

## Suggested props (React Dimensions component)
`data, normalize, orientation, labels, gap, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
