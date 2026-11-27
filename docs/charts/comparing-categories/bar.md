# Bar / Column Chart

**Group:** Comparing categories

## What it shows
One bar per category, length proportional to value.

## Best for
Ranking or comparing a handful to a few dozen categories.

## Avoid when
There are hundreds of categories, or the x-axis is continuous time (use a line).

## Data it needs
One category + one number per bar; stacked/grouped add a second category.

## Variants
Horizontal (bar) vs vertical (column), grouped, stacked, 100% stacked, diverging.

## Suggested props (React Dimensions component)
`data, orientation, stacked, grouped, sort, barRadius, gap, showValues, colors, animate`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
