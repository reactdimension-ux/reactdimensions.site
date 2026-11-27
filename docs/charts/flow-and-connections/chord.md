# Chord Diagram

**Group:** Flow and connections

## What it shows
Groups on a circle joined by ribbons sized by flow.

## Best for
Relationships/exchange between a modest number of entities.

## Avoid when
More than ~15 groups.

## Data it needs
Square matrix of flows.

## Variants
Directed, undirected, with hover isolate.

## Suggested props (React Dimensions component)
`matrix, labels, padAngle, innerRadius, colors, onHover`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
