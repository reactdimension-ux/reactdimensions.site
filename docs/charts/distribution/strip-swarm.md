# Strip / Swarm Plot

**Group:** Distribution

## What it shows
Every data point drawn, spread so none overlap.

## Best for
Small to medium datasets where every point matters.

## Avoid when
Thousands of points.

## Data it needs
Value + group per point.

## Variants
Strip (jitter), beeswarm, with mean marker.

## Suggested props (React Dimensions component)
`points, groups, jitter, pointSize, orientation, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
