# Cartogram

**Group:** Geographic

## What it shows
A map distorted so area or size shows a value instead of land area.

## Best for
When land area misleads (population, votes).

## Avoid when
Readers must recognise exact geography.

## Data it needs
Region + value, plus geometry or grid.

## Variants
Tile grid, Dorling circles, contiguous.

## Suggested props (React Dimensions component)
`geo, data, mode, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
