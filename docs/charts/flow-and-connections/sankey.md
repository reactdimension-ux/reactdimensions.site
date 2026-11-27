# Sankey Diagram

**Group:** Flow and connections

## What it shows
Bands between nodes, with width proportional to flow.

## Best for
Where quantities come from and go (energy, budgets, user journeys).

## Avoid when
Cycles or a few trivial flows.

## Data it needs
Source, target, value links.

## Variants
Horizontal, vertical, highlighted path on hover.

## Suggested props (React Dimensions component)
`nodes, links, nodeWidth, nodePadding, align, colors, onHover`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
