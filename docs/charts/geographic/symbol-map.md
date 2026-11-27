# Bubble / Symbol Map

**Group:** Geographic

## What it shows
Dots on a map sized or coloured by a value.

## Best for
Point data like cities, stores or events.

## Avoid when
Data belongs to regions (use a choropleth).

## Data it needs
Lat, long, value.

## Variants
Sized bubbles, pins, clustered, pulsing.

## Suggested props (React Dimensions component)
`points, projection, sizeKey, colorBy, cluster`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
