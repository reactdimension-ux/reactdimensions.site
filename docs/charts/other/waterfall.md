# Waterfall Chart

**Group:** Other

## What it shows
Floating bars showing how additions and subtractions build to a total.

## Best for
Profit bridges, budgets, step-by-step changes.

## Avoid when
Items are not additive.

## Data it needs
Start, steps (+/-), end.

## Variants
Vertical, horizontal, with totals and subtotals.

## Suggested props (React Dimensions component)
`steps, showTotal, upColor, downColor, connectors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
