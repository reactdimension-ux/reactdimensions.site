import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import BusScene from './bus/BusScene.jsx'

const q = new URLSearchParams(location.search)
const flag = (k, d) => (q.has(k) ? q.get(k) !== '0' : d)
const cam = q.get('cam')?.split(',').map(Number)
const props = { view: cam ? () => ({ pos: new THREE.Vector3(cam[0], cam[1], cam[2]), target: new THREE.Vector3(cam[3], cam[4], cam[5]) }) : q.get('view') || 'front-left', doors: flag('doors', false), lights: flag('lights', true) }
createRoot(document.getElementById('root')).render(<BusScene {...props} />)
