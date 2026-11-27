# Pie / Donut Chart

**Group:** Parts of a whole

## What it shows
Slices of a circle sized by share of the total.

## Best for
2-5 parts that add to 100%, one dominant message.

## Avoid when
Many slices, similar sizes, or comparing across several pies (use bars).

## Data it needs
Label + value (summed to a total).

## Variants
Pie, donut with centre label, half-circle, exploded slice.

## Suggested props (React Dimensions component)
`data, innerRadius, startAngle, padAngle, centerLabel, sortSlices, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
