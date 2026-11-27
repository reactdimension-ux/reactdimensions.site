# Candlestick / OHLC Chart

**Group:** Change over time

## What it shows
Open, high, low and close for each period as a body with wicks.

## Best for
Financial price action.

## Avoid when
Data is not OHLC.

## Data it needs
Date, open, high, low, close (+ volume).

## Variants
Candlestick, OHLC bars, Heikin-Ashi, with volume pane.

## Suggested props (React Dimensions component)
`data, upColor, downColor, wickWidth, showVolume, crosshair, zoom`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
