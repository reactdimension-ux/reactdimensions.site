# Flow Map

**Group:** Geographic

## What it shows
Lines or arcs between places, width showing volume.

## Best for
Movement: trade, flights, migration.

## Avoid when
Too many flows without filtering.

## Data it needs
Origin, destination, value.

## Variants
Great-circle arcs, animated particles.

## Suggested props (React Dimensions component)
`flows, projection, curve, animateDots, widthScale`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
