# 3D Low-Poly Tiger

A flat-shaded, low-poly tiger modelled in React + Three.js (`@react-three/fiber`, `@react-three/drei`). Everything is built from code: no model files or image assets.

## Run

```bash
npm install
npm run dev
```

## Features

**Model**
- Body, head and legs are skinned from cross-section rings, with every triangle given its own vertices so each face shades flat.
- Stripes are painted per face, not textured: each stripe is its own thin band of polygons, so it ends exactly on polygon edges and tapers to a point on the flank.
- Cream belly, chest, cheeks, muzzle and paws; dark ears with cream inners; cheek tufts; three-toed paws.
- Face built from small parts: disc eyes with iris, pupil and glint, slanted brows for the glare, nose and a frowning mouth.
- Tail made of six jointed pieces, alternating orange and black, curling up to a dark tip.

**Animation**
- Standing: breathing, blinking, ear flicks, a swaying tail, and a head that follows the pointer.
- **Walk**: a four-beat walk cycle around a circle. Ground speed is matched to the leg swing so the paws do not slide.
- Drag to orbit, scroll to zoom, **Auto-spin** for a turntable.
- Keyboard: **W** or **Space** to walk, **R** to spin.

**Lighting**
- Tone mapping is off so the colours stay vivid.
- Sky light plus one shadow-casting key light and a warm fill.
- Transparent canvas over a CSS gradient backdrop; the floor only shows the tiger's shadow.

## Files

- `src/geometry.js`: palette, the ring-skinning builder, and body, head, leg, ear and tail geometry
- `src/Tiger.jsx`: materials, assembly, pose and animation
- `src/App.jsx`: lights, shadow floor, camera controls and buttons
