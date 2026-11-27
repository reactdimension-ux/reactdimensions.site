// Sub-sections for the categories that are split into groups in the sidebar and
// on the category pages. Each group lists its components by slug, in order.
// A component that is not listed falls into the group marked `rest`.

const group = (name, slugs, rest = false) => ({ name, slugs, rest })


const ANIMATION = [
  group('Cards & carousels', ['tilt-card', 'peek-card', 'tilt-reveal', 'throw-cards', 'drag-cards', 'swipe-throw', 'depth-gallery', 'scroll-gallery', 'halo-carousel', 'key-carousel', 'snap-rail', 'testimonial-slider']),
  group('Buttons & taps', ['spring-button', 'magnetic-button', 'hold-button', 'tap-ripple', 'double-tap-like', 'hold-preview', 'long-hover-preview', 'hotkey-hints', 'preset-cycle', 'wobble-edit']),
  group('Cursor & hover', ['cursor-trail', 'morph-cursor', 'proximity-glow', 'hover-scrub', 'presence-cursors', 'melting-glow', 'trackpad-scrub', 'edge-peek-nav', 'follow-drawer']),
  group('Drag & scroll', ['inertia-snap', 'drag-reorder', 'pull-refresh', 'rubber-slider', 'scroll-rotate', 'scroll-skew', 'axis-lock-drag', 'compare-slider', 'reading-ring', 'space-pause']),
  group('Text & data', ['focus-headline', 'benchmark-bars', 'type-search', 'undo-history', 'url-state']),
  group('Interactive 3D', ['drag-model', 'tilt-orbit'], true),
]

// groups match docs/ai-agents/ai-agent-components.md; empty ones stay hidden until they have components
const AGENTS = [
  group('Status & thinking', ['thinking-indicator', 'streaming-text', 'reasoning-panel', 'step-timeline', 'progress-checklist', 'token-counter', 'elapsed-timer', 'status-pill', 'context-meter']),
  group('Conversation', ['chat-bubbles', 'typing-indicator', 'prompt-box', 'suggestion-chips', 'message-actions', 'citation-pills', 'voice-orb', 'attachment-chips', 'model-picker', 'conversation-list', 'feedback-bar']),
  group('Agent at work', ['agent-console', 'tool-call-card', 'terminal-log', 'code-diff', 'file-tree-activity', 'browser-agent', 'approval-prompt', 'sub-agent-graph', 'memory-recall', 'search-results-stream', 'plan-editor', 'run-history']),
  group('Playful & 3D', [], true),
]

const CHARTS = [
  group('Comparing categories', ['bar-chart', 'lollipop-chart', 'dot-plot', 'bullet-chart', 'radar-chart']),
  group('Change over time', ['line-chart', 'area-chart', 'step-chart', 'sparklines', 'candlestick-chart', 'gantt-chart', 'streamgraph']),
  group('Parts of a whole', ['pie-chart', 'treemap', 'sunburst', 'waffle-chart', 'share-bar']),
  group('Single values and progress', ['gauge-chart', 'progress-chart', 'kpi-tiles']),
  group('Distribution', ['histogram', 'box-plot', 'violin-plot', 'ridgeline-plot', 'strip-plot']),
  group('Relationships', ['scatter-plot', 'bubble-chart', 'heatmap', 'hexbin-plot', 'correlation-matrix']),
  group('Flow and connections', ['sankey-diagram', 'alluvial-diagram', 'chord-diagram', 'network-graph', 'funnel-chart', 'tree-chart']),
  group('More charts', ['waterfall-chart', 'pareto-chart', 'slope-chart', 'population-pyramid', 'parallel-coordinates', 'word-cloud'], true),
  group('3D charts', ['pie-3d-chart', 'bar-3d-chart', 'pyramid-3d-chart', 'scatter-3d-chart', 'surface-3d-chart', 'waffle-3d-chart', 'gauge-3d-chart', 'cylinders-3d-chart']),
  group('Flat · Comparing', ['flat-bar-chart', 'flat-lollipop-chart', 'flat-dot-plot', 'flat-bullet-chart', 'flat-radar-chart', 'flat-slope-chart', 'flat-population-pyramid']),
  group('Flat · Change over time', ['flat-line-chart', 'flat-area-chart', 'flat-step-chart', 'flat-sparklines', 'flat-candlestick-chart', 'flat-gantt-chart', 'flat-streamgraph']),
  group('Flat · Parts of a whole', ['flat-donut-chart', 'flat-treemap', 'flat-sunburst', 'flat-dot-matrix', 'flat-pictogram', 'flat-share-bar']),
  group('Flat · Single values', ['flat-gauge-chart', 'flat-percent-rings', 'flat-progress-bars', 'flat-kpi-tiles']),
  group('Flat · Distribution', ['flat-histogram', 'flat-box-plot', 'flat-violin-plot', 'flat-ridgeline-plot', 'flat-strip-plot']),
  group('Flat · Relationships', ['flat-scatter-plot', 'flat-bubble-chart', 'flat-heatmap', 'flat-hexbin-plot', 'flat-correlation-matrix', 'flat-parallel-coordinates']),
  group('Flat · Flow and connections', ['flat-sankey-diagram', 'flat-alluvial-diagram', 'flat-chord-diagram', 'flat-network-graph', 'flat-tree-chart', 'flat-pyramid-chart']),
  group('Flat · Infographic', ['flat-peaks-chart', 'flat-pin-chart', 'flat-step-timeline', 'flat-waterfall-chart', 'flat-pareto-chart', 'flat-word-cloud']),
  group('Doodle · More charts', ['doodle-slope-chart', 'doodle-population-pyramid', 'doodle-parallel-coordinates', 'doodle-word-cloud']),
  group('Doodle · Parts of a whole', ['doodle-pie-chart', 'doodle-treemap', 'doodle-sunburst', 'doodle-waffle-chart', 'doodle-share-bar']),
  group('Doodle · Distribution', ['doodle-histogram', 'doodle-box-plot', 'doodle-violin-plot', 'doodle-ridgeline-plot', 'doodle-strip-plot']),
  group('Doodle · Comparing', ['doodle-bar-chart', 'doodle-lollipop-chart', 'doodle-dot-plot', 'doodle-bullet-chart', 'doodle-radar-chart']),
  group('Doodle · Change over time', ['doodle-line-chart', 'doodle-area-chart', 'doodle-step-chart', 'doodle-sparklines', 'doodle-candlestick-chart', 'doodle-gantt-chart', 'doodle-streamgraph']),
  group('Doodle · Flow and connections', ['doodle-sankey-diagram', 'doodle-alluvial-diagram', 'doodle-chord-diagram', 'doodle-network-graph', 'doodle-funnel-chart', 'doodle-tree-chart']),
  group('Doodle · Relationships', ['doodle-scatter-plot', 'doodle-bubble-chart', 'doodle-heatmap', 'doodle-hexbin-plot', 'doodle-correlation-matrix']),
  group('Doodle · Single values', ['doodle-gauge-chart', 'doodle-progress-chart', 'doodle-kpi-tiles', 'doodle-waterfall-chart', 'doodle-pareto-chart']),
]

const ANIMALS = [
  group('Wild animals', ['giraffe', 'hippo', 'zebra', 'rhino', 'elephant', 'fox', 'tiger', 'wolf', 'bear']),
  group('Pets', ['puppy', 'cat', 'hamster', 'ferret', 'guinea-pig', 'bunny']),
  group('Birds & water', ['parrot', 'budgie', 'chicken', 'penguin', 'goldfish', 'turtle']),
  group('Blocky & toy', ['blocky-polar-bear', 'blocky-panda', 'blocky-panther', 'toy-lion'], true),
]

const lp = (list) => list.map((s) => `low-poly-${s}`)
const LOWPOLY = [
  group('Animals', lp(['fox', 'butterfly', 'bear', 'lion', 'bengal-tiger', 'leopard', 'dog', 'cat', 'jellyfish', 'snail', 'hummingbird', 'crab', 'octopus', 'flamingo', 'hedgehog', 'parrot', 'deer', 'penguin', 'owl', 'bunny', 'turtle', 'bee', 'whale', 'frog', 'elephant', 'dino', 'chameleon', 'sloth', 'peacock', 'red-panda', 'manta-ray', 'axolotl', 'pufferfish', 'seahorse', 'stag-beetle', 'ladybug', 'rubber-duck'])),
  group('Nature & landscapes', lp(['pine', 'grass-tile', 'crystal-rock', 'bamboo', 'cherry-blossom', 'autumn-maple', 'lily-pond', 'geyser', 'tornado', 'coral-reef', 'flower', 'rainbow', 'stump', 'mushrooms', 'palm', 'cactus', 'sunflower', 'bonsai', 'cloud', 'mountain', 'island', 'iceberg', 'volcano', 'waterfall', 'aurora-hills', 'sea-stack', 'rice-terraces', 'venus-flytrap', 'snowy-pines', 'mangrove', 'fern', 'rock-arch', 'dandelion', 'watermelon', 'campfire', 'pumpkin', 'snowman'])),
  group('Buildings & places', lp(['igloo', 'torii-gate', 'barn', 'wishing-well', 'pagoda', 'windmill', 'lighthouse', 'castle-tower', 'campsite', 'cottage', 'ferris-wheel', 'diorama', 'homestead', 'treehouse', 'fountain', 'haunted-house', 'observatory', 'stone-bridge', 'drive-in-cinema', 'wizard-tower', 'clock-tower', 'bakery', 'water-tower', 'beach-huts', 'street-lamp', 'mailbox'])),
  group('Vehicles', lp(['rowboat', 'submarine', 'biplane', 'tractor', 'food-truck', 'sailboat', 'steam-train', 'rocket', 'paper-plane', 'balloon', 'mech-walker', 'monster-truck', 'race-car', 'paddle-steamer', 'lunar-rover', 'scooter', 'hovercraft', 'bullet-train', 'cable-car', 'canal-gondola'])),
  group('Space & fantasy', lp(['ufo', 'moon', 'ringed-planet', 'tiny-planet', 'black-hole', 'comet', 'space-station', 'dragon-egg', 'potion', 'gem', 'robot'])),
  group('Objects & treats', [], true),
]

export const SECTION_GROUPS = {
  Animation: ANIMATION,
  'AI Agents': AGENTS,
  Charts: CHARTS,
  Animals: ANIMALS,
  'Low Poly 3D': LOWPOLY,
}

// the section names of each split category, in display order
export const SECTION_NAMES = Object.fromEntries(Object.entries(SECTION_GROUPS).map(([cat, gs]) => [cat, gs.map((g) => g.name)]))

// the section a component belongs to, or its own style for the other categories
export function sectionOf(c) {
  const groups = SECTION_GROUPS[c.category]
  if (!groups) return c.style
  const hit = groups.find((g) => g.slugs.includes(c.slug)) ?? groups.find((g) => g.rest)
  return hit.name
}
