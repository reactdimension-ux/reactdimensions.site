# Network / Graph

**Group:** Flow and connections

## What it shows
Nodes and the links between them.

## Best for
Connections, communities and hubs.

## Avoid when
Very dense graphs ("hairball") without filtering.

## Data it needs
Nodes + edges.

## Variants
Force-directed, radial, arc diagram, draggable nodes.

## Suggested props (React Dimensions component)
`nodes, links, layout, charge, linkDistance, draggable, colorBy`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
