# Gantt Chart

**Group:** Change over time

## What it shows
Tasks as bars along a timeline with start, end and dependencies.

## Best for
Schedules and project plans.

## Avoid when
Tasks have no durations.

## Data it needs
Task, start, end, optional parent/dependency, progress.

## Variants
Grouped, with dependencies, with today line, with progress fill.

## Suggested props (React Dimensions component)
`tasks, rowHeight, zoom, showToday, showDependencies, colors`

Every option should be a prop with a default, with `prefers-reduced-motion` respected and an accessible text summary (`role="img"` with an `aria-label`, or a visually hidden data table).
