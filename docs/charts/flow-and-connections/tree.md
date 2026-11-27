# Tree / Dendrogram / Flowchart

**Group:** Flow and connections

## What it shows
Boxes or nodes joined to show hierarchy or process.

## Best for
Org charts, taxonomies, clustering, decision paths.

## Avoid when
The data is a many-to-many network (use a graph).

## Data it needs
Parent-child nodes or steps and arrows.

## Variants
Top-down, left-right, radial, collapsible.

## Suggested props (React Dimensions component)
`data, orientation, nodeSize, collapsible, linkStyle, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
