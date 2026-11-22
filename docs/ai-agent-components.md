# AI Agents: Component Ideas and How to Build Them

A plan for the **AI Agents** section of the library. The first component, **Thinking Indicator**, is already built (`dimensions-ui/src/lib/ThinkingIndicator.jsx`). This file lists 40 more, then explains how to build one, step by step.

Each idea has a one-line **What**, and where it helps, a **Build note** on the one thing that is tricky about it.

---

## Part 1: The ideas

### A. Status and thinking

| # | Component | What | Build note |
|---|-----------|------|------------|
| 1 | **Thinking Indicator** (built) | Glyph that grows and shrinks beside a shimmering word: "Marinating…" | `setInterval` over glyph frames; background-clip text for the shimmer |
| 2 | **Streaming Text** | A reply typed out word by word with a blinking cursor | Reveal tokens on a timer; keep the cursor as its own element so it never reflows |
| 3 | **Tool Call Card** | "Running search…" row that turns into a tick or cross | A `status` prop: `running`, `done`, `error`; animate the icon swap |
| 4 | **Reasoning Panel** | Collapsible "Thought for 8s" box that opens to show the steps | Animate height with `grid-template-rows: 0fr → 1fr`, no measuring needed |
| 5 | **Step Timeline** | A plan of steps ticking off one by one, current step pulsing | Array of steps plus an `active` index; draw the connector line with a pseudo-element |
| 6 | **Progress Checklist** | A todo list that updates live as the agent works | Controlled list; strike-through animates with a growing background gradient |
| 7 | **Token Counter** | A number that counts up with a small cost readout | `requestAnimationFrame` easing; format with `Intl.NumberFormat` |
| 8 | **Elapsed Timer** | "12s · esc to interrupt" that ticks while working | One interval; stop it when `running` is false |
| 9 | **Status Pill** | Idle / Thinking / Working / Done as a small pill with a colour dot | Map status to colour in one object; pulse the dot only while active |
| 10 | **Context Meter** | A bar showing how much of the context window is used | Threshold colours: green, amber, red; animate width with a transition |

### B. Conversation

| # | Component | What | Build note |
|---|-----------|------|------------|
| 11 | **Chat Bubbles** | User and agent messages with a "typing…" bubble | Three dots with staggered `animation-delay`; align by role |
| 12 | **Prompt Box** | Text input with send, attach and mic, and a slash-command menu | Auto-growing `textarea`; open the menu when the line starts with `/` |
| 13 | **Suggestion Chips** | Quick replies that appear under a message | Stagger entrance with an index-based delay |
| 14 | **Message Actions** | Copy, regenerate, thumbs up and down, shown on hover | Show on `:hover` and `:focus-within` so keyboard users get them too |
| 15 | **Citation Pills** | Numbered source links inline, with a preview card on hover | Render the text as parts; position the card with CSS anchor or a small portal |
| 16 | **Voice Orb** | A pulsing orb that reacts to speaking or listening | Drive scale from an `amplitude` prop; fake it with noise when there is no audio |
| 17 | **Attachment Chips** | Files added to a prompt, with a remove button and a progress ring | SVG circle with `stroke-dashoffset` for the ring |
| 18 | **Model Picker** | A dropdown of models with speed and cost tags | Native `select` styled, or a listbox with arrow-key support |
| 19 | **Conversation List** | A sidebar of past chats with search and a new-chat button | Filter in memory; group by Today / Yesterday / Earlier |
| 20 | **Feedback Bar** | "Was this helpful?" that expands into a reason picker | Two-step state: `idle → reasons → thanks` |

### C. The agent at work

| # | Component | What | Build note |
|---|-----------|------|------------|
| 21 | **Terminal Log** | A scrolling command log with coloured output | Append lines on a timer; keep scrolled to the bottom unless the user scrolls up |
| 22 | **Code Diff** | Added and removed lines animating in, with Accept and Reject | Split lines by prefix `+` / `-`; fade each line in with a stagger |
| 23 | **File Tree Activity** | Files lighting up as the agent reads or edits them | Nested list; a `events` prop of `{path, type}` flashes the matching row |
| 24 | **Browser Agent** | A mock browser where a cursor clicks and types by itself | Script of `{x, y, action}` steps; animate the cursor with CSS transitions |
| 25 | **Approval Prompt** | "Allow this action?" with Allow, Deny, Always allow | A real `dialog`; return the choice through an `onChoose` callback |
| 26 | **Sub-agent Graph** | Nodes for several agents that light up as work passes between them | SVG nodes and edges; animate a dot along each edge with `offset-path` |
| 27 | **Memory Recall** | Small "remembered" cards fading in beside a message | Absolutely positioned cards with a delayed fade and small drift |
| 28 | **Search Results Stream** | Result cards that appear one at a time as the agent finds them | Append to an array; use `layout` animation or a simple translate-in |
| 29 | **Plan Editor** | An editable plan: reorder, remove, add steps before running | Drag-to-reorder with pointer events; reuse the `Drag Reorder` component's logic |
| 30 | **Run History** | A list of past runs with duration, status and cost | Table with sortable columns; status uses the Status Pill |

### D. Playful and 3D

| # | Component | What | Build note |
|---|-----------|------|------------|
| 31 | **Agent Avatar** | A face or orb that changes between idle, thinking and done | One SVG; swap eye and mouth paths per state with a transition |
| 32 | **Neural Pulse** | A node network with light travelling through it | Canvas 2D; nodes in a grid, pulses move along random edges |
| 33 | **Robot Helper (3D)** | A low-poly robot that nods while thinking and waves when done | Reuse the Low Poly 3D scene setup; drive limbs from `state` in `useFrame` |
| 34 | **Thought Bubbles** | Little bubbles rising from an avatar while it thinks | Spawn and remove bubbles with CSS animation and an `animationend` handler |
| 35 | **Orbiting Tools** | Tool icons orbiting a central agent; the active tool glows | Rotate a wrapper; counter-rotate each icon so it stays upright |
| 36 | **Loading Skeleton** | Placeholder lines shaped like an agent reply | Gradient sweep, same trick as the Thinking Indicator shimmer |
| 37 | **Error Recovery** | "That didn't work, trying another way…" with a retry counter | State machine: `trying → failed → retrying → ok` |
| 38 | **Confidence Gauge** | A dial showing how sure the agent is | SVG arc with `stroke-dasharray`; needle eased with a spring |
| 39 | **Handoff Banner** | "Passing you to a human" with a connecting animation | Two avatars and an animated line between them |
| 40 | **Agent Roster** | A grid of agent cards with role, status and a tiny sparkline | Card grid; sparkline is a single SVG polyline |

### Best first batch

Pick these five first. They look good on a page, and each shows a different part of what an agent does:

1. **Streaming Text** (the thing everyone expects)
2. **Tool Call Card** (shows work being done)
3. **Step Timeline** (shows a plan)
4. **Approval Prompt** (shows control)
5. **Voice Orb** (the most eye-catching)

### Suggested sections inside AI Agents

Once there are more than a dozen, split the sidebar the same way Animation is split. Names: **Status & thinking**, **Conversation**, **Agent at work**, **Playful & 3D**. Section 4 below shows how.

---

## Part 2: How to build one

Every library component is the same four pieces: a component file, a registry entry, a preview image, and the sources shown in the "Code" tab. Follow these steps.

### Step 1: Write the component

Create `dimensions-ui/src/lib/YourComponent.jsx`.

Rules that keep every component consistent:

- **One default export**, a function component.
- **Every option is a prop with a default.** Anything you want a user to tweak becomes a control later.
- **No outside dependencies** unless you must (use `three` and `@react-three/fiber` only for 3D ones).
- **Inline styles and an inline `<style>` block** for keyframes, so a copied file works anywhere. No separate CSS file.
- **Respect reduced motion**: add `@media (prefers-reduced-motion: reduce)` and stop looping animation.
- **Add `role` and `aria-live`** on anything that shows status, so screen readers hear it.
- **Clean up** every `setInterval`, `requestAnimationFrame` and event listener in the `useEffect` return.

A minimal shape:

```jsx
import { useEffect, useState } from 'react'

export default function ToolCallCard({
  name = 'Searching the web',
  status = 'running', // 'running' | 'done' | 'error'
  color = '#d77757',
  background = '#141414',
}) {
  return (
    <div role="status" style={{ background, borderRadius: 10, padding: '12px 16px', font: '400 15px/1.2 ui-monospace, Menlo, monospace', color: '#c9c6bf' }}>
      <style>{`@keyframes tc-spin{to{transform:rotate(360deg)}}`}</style>
      {/* icon swaps with status; label stays */}
      {name}
    </div>
  )
}
```

### Step 2: Register it

In `dimensions-ui/src/library/registry.jsx`:

1. Add the import near the top:

   ```jsx
   import ToolCallCard from '../lib/ToolCallCard.jsx'
   ```

2. Add an entry to `ALL_COMPONENTS`, with `category: 'AI Agents'`:

   ```jsx
   {
     slug: 'tool-call-card',
     name: 'Tool Call Card',
     category: 'AI Agents',
     description: 'A tool call that runs, then turns into a tick or a cross.',
     controls: [
       { name: 'name', type: 'text', default: 'Searching the web' },
       { name: 'status', type: 'select', options: ['running', 'done', 'error'], default: 'running' },
       { name: 'color', type: 'color', default: '#d77757' },
       { name: 'background', type: 'color', default: '#141414' },
     ],
     preview: (p) => <ToolCallCard {...p} />,
     files: ['ToolCallCard.jsx'],
     deps: [],
   },
   ```

Control types you can use:

| Type | Fields |
|------|--------|
| `range` | `min`, `max`, `step`, `default`, optional `unit` |
| `toggle` | `default` true or false |
| `select` | `options` array, `default` |
| `text` | `default` |
| `color` | `default` hex |

`files` lists what the "Code" tab shows and what the user copies. `deps` lists npm packages they need (empty for plain components).

### Step 3: Make the preview image

The cards in the library grid use `dimensions-ui/public/previews/<slug>.jpg`, sized **608 × 380**.

1. Run the site: `npm run dev` in `dimensions-ui`.
2. Open `/library/c/ai-agents`, open your component and set it to its best-looking state.
3. Screenshot just the stage at 608 × 380 and save it as `public/previews/tool-call-card.jpg`.

A missing image shows a blank card, so always add one. Use a dark background so the AI Agents cards look like a set.

### Step 4: Split the section (when it grows)

When the section has many components, group them. In `dimensions-ui/src/library/sections.js`:

```js
const AGENTS = [
  group('Status & thinking', ['thinking-indicator', 'tool-call-card', 'step-timeline']),
  group('Conversation', ['streaming-text', 'prompt-box']),
  group('Agent at work', ['approval-prompt', 'terminal-log']),
  group('Playful & 3D', [], true), // the `true` makes it the catch-all
]

export const SECTION_GROUPS = {
  Animation: ANIMATION,
  'AI Agents': AGENTS,
  // …
}
```

Then, in `Library.jsx`, `'AI Agents'` is picked up automatically because `SECTIONS` already spreads `...SECTION_NAMES`.

### Step 5: Check it

```bash
cd dimensions-ui
npm run dev      # look at it in the browser
npm run build    # must finish without errors
```

Checklist before you commit:

- [ ] Every control changes the preview as expected
- [ ] No console errors or warnings
- [ ] Works at phone width (resize the stage)
- [ ] Animation stops with reduced motion on
- [ ] Preview image exists and looks right in the grid
- [ ] No timer keeps running after you leave the page

---

## Part 3: Build recipes for the harder ones

### Streaming text

- Split the reply into words, keep a `count` in state, and add one word per tick.
- Show the cursor as `<span>` after the last word with a `step-end` blink animation.
- Expose `speed` (words per second) and a `loop` toggle that restarts after a pause.
- For real use, accept a `text` prop and, optionally, an async iterator so it can show a live model stream.

### Step timeline

- Props: `steps` (array of labels), `active` (index), and `autoplay` for the demo.
- Draw each step as a dot with a connector. Done steps are filled, the active step pulses, upcoming steps are hollow.
- Animate the connector fill by transitioning `transform: scaleY` from 0 to 1.

### Approval prompt

- Use the native `<dialog>` element (`showModal()`) so focus trapping and Escape work for free.
- Three buttons: Allow, Deny, Always allow. Return the choice through `onChoose(choice)`.
- Show the exact action in a monospace box so the user knows what they are allowing.

### Voice orb

- A circle with a radial gradient, scaled by `amplitude` (0 to 1).
- Without microphone input, drive `amplitude` from smoothed random noise so it looks alive in the demo.
- Offer `state`: `idle`, `listening`, `speaking`; each changes colour and pulse speed.
- If you wire up the real microphone, use `AudioContext` and an `AnalyserNode`, and ask permission only on a click.

### Sub-agent graph

- Nodes at fixed positions in an SVG. Edges are `<path>` lines.
- To send a pulse along an edge, animate a small circle with CSS `offset-path: path(...)` and `offset-distance: 0% → 100%`.
- Highlight the node that currently holds the work by changing its stroke and adding a soft glow.

### Robot helper (3D)

- Start from an existing Low Poly 3D component (for example Low Poly Robot) so lighting, orbit controls and the control dock are already in place.
- Add a `state` prop and, in `useFrame`, move the head (nod), arms (wave) or antenna (blink) per state.
- Keep geometry cheap: flat-shaded boxes and spheres, no textures.

### Browser agent

- Build a fake window with a toolbar and a page body.
- Describe the run as a list of steps: `{ at: 800, x: 120, y: 80, action: 'click' }`.
- Move the cursor element with a CSS transition on `transform`; on `click`, show a ripple; on `type`, append characters to an input.

---

## Part 4: Style guide for this section

So the AI Agents components feel like one family:

- **Font:** monospace for agent output (`ui-monospace, "SF Mono", Menlo, Consolas`), the site font for anything that is chat.
- **Colour:** dark surfaces (`#141414`), light text (`#c9c6bf`), and one accent. The default accent is the Claude orange `#d77757`. Every colour is a control.
- **Corners:** 10 px on cards, 6 px on small chips. Keep curvature low, as on the rest of the site.
- **Motion:** slow and soft. Loops between 1.2 s and 3 s. Nothing flashes more than three times a second.
- **Language:** plain verbs, with an ellipsis character (…) for work in progress, not three dots.
- **State names:** reuse the same words everywhere: `idle`, `thinking`, `running`, `done`, `error`.

## Part 5: A sensible build order

1. Streaming Text, Tool Call Card (the base of everything else)
2. Step Timeline, Approval Prompt, Voice Orb (the first batch)
3. Chat Bubbles, Prompt Box (so the section can show a whole conversation)
4. Terminal Log, Code Diff (the "agent at work" group)
5. Agent Avatar, Neural Pulse (for the playful end)
6. Robot Helper (3D), Sub-agent Graph (the showpieces)

Once five or six exist, add an **Agent Console** demo that combines them (prompt box, streaming reply, tool calls, step timeline and approval prompt in one window). It is the best single thing to put on the landing page carousel for this section.
