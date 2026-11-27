# Step Chart

**Group:** Change over time

## What it shows
A line that holds its value and jumps at each change.

## Best for
Values that change at discrete moments (prices, plans, status).

## Avoid when
The value changes continuously.

## Data it needs
Timestamped changes.

## Variants
Step before / after / middle.

## Suggested props (React Dimensions component)
`data, stepType, strokeWidth, fill, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
