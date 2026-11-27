# Choropleth Map

**Group:** Geographic

## What it shows
Regions shaded by a value.

## Best for
Rates or densities per region.

## Avoid when
Raw totals, since big regions dominate (normalise first).

## Data it needs
Region id + value, plus a map geometry.

## Variants
World, country, state/county, with zoom.

## Suggested props (React Dimensions component)
`geo, data, colorScale, projection, tooltip, onSelect`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
