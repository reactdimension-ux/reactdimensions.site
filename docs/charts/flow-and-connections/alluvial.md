# Alluvial Diagram

**Group:** Flow and connections

## What it shows
A Sankey that follows groups across several stages or points in time.

## Best for
How membership changes between categories over time.

## Avoid when
Only two stages (use Sankey).

## Data it needs
Items with a category at each stage.

## Variants
Ordered, coloured by first stage.

## Suggested props (React Dimensions component)
`stages, links, nodeWidth, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
