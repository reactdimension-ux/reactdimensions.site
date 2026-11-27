# Dot Plot (Cleveland)

**Group:** Comparing categories

## What it shows
One dot per category on a shared axis; two dots per row show before/after.

## Best for
Comparing values (or two groups) without the weight of bars.

## Avoid when
Audience expects bars and the axis must start at zero for honesty.

## Data it needs
Category + one or two values.

## Variants
Single dot, paired dots with connector, ranked.

## Suggested props (React Dimensions component)
`data, pairs, connector, sort, dotSize, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
