// Shared, mutable state read inside render loops (no React re-renders).

// Driver input. Keyboard and touch buttons both write here.
export const input = {
  keys: new Set(),
  touch: { up: false, down: false, left: false, right: false, brake: false },
}

export function readInput() {
  const k = input.keys
  const t = input.touch
  const up = t.up || k.has('KeyW') || k.has('ArrowUp')
  const down = t.down || k.has('KeyS') || k.has('ArrowDown')
  const left = t.left || k.has('KeyA') || k.has('ArrowLeft')
  const right = t.right || k.has('KeyD') || k.has('ArrowRight')
  const brake = t.brake || k.has('Space')
  return {
    throttle: (up ? 1 : 0) - (down ? 1 : 0),
    steer: (left ? 1 : 0) - (right ? 1 : 0),
    brake,
  }
}

// The truck's position on the floor. Heading is the rotation about y;
// the truck's nose points along (cos h, 0, -sin h).
export const START = { x: 0, z: 0, heading: -0.65 }
export const vehicle = {
  ...START,
  speed: 0, // m/s along the heading (negative = reversing)
  steer: 0, // front wheel angle, radians
  resetCount: 0,
}

export function resetVehicle() {
  Object.assign(vehicle, START, { speed: 0, steer: 0, dir: undefined })
  vehicle.resetCount++
}
