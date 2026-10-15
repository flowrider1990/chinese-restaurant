/**
 * Builds public/map/restaurant.svg: our own drawing of the streets around the restaurant
 * (site settings → "Koordinaten"), rendered from OpenStreetMap data. Visitors load the map from
 * this site, so no third party is contacted when the page is viewed.
 *
 * Why data instead of map tiles: the OSM tile policy does not permit offline use of
 * tile.openstreetmap.org. The data itself is ODbL-licensed and may be rendered freely with
 * attribution ("© OpenStreetMap-Mitwirkende"), which the restaurant page shows below the map.
 *
 * Usage: pnpm map:generate   (re-run after the restaurant's coordinates change; one Overpass query)
 */
import 'dotenv/config'
import { mkdir, writeFile } from 'fs/promises'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const WIDTH = 1200
const HEIGHT = 600
const ZOOM = 16.3 // map scale in Web Mercator zoom levels (≈1.2 m per pixel here)
// Public Overpass instances; the next one is tried when one is overloaded (HTTP 429/504).
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const USER_AGENT = 'chinese-restaurant-website/1.0 (static map, one-off build step)'

const payload = await getPayload({ config })
const settings = await payload.findGlobal({ slug: 'site-settings' })
if (!settings.geo) {
  console.error('No coordinates set in the site settings ("Koordinaten"). Nothing generated.')
  process.exit(1)
}
const [lng, lat] = settings.geo
const name = settings.name

// --- Projection (Web Mercator, centred on the restaurant) ------------------------------------

const worldSize = 256 * 2 ** ZOOM
const mercX = (lon: number) => ((lon + 180) / 360) * worldSize
const mercY = (la: number) =>
  ((1 - Math.log(Math.tan((la * Math.PI) / 180) + 1 / Math.cos((la * Math.PI) / 180)) / Math.PI) / 2) * worldSize
const cx = mercX(lng)
const cy = mercY(lat)
const project = (p: { lat: number; lon: number }) => [mercX(p.lon) - cx + WIDTH / 2, mercY(p.lat) - cy + HEIGHT / 2]
const unprojectLon = (x: number) => ((x + cx - WIDTH / 2) / worldSize) * 360 - 180
const unprojectLat = (y: number) => {
  const n = Math.PI - (2 * Math.PI * (y + cy - HEIGHT / 2)) / worldSize
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}
const pad = 80
const bbox = [unprojectLat(HEIGHT + pad), unprojectLon(-pad), unprojectLat(-pad), unprojectLon(WIDTH + pad)]
  .map((v) => v.toFixed(6))
  .join(',')

// --- OSM data -------------------------------------------------------------------------------

const query = `[out:json][timeout:60];
(
  way["highway"~"^(primary|secondary|tertiary|residential|living_street|unclassified|pedestrian|service)$"](${bbox});
  way["railway"~"^(rail|light_rail|subway|tram)$"](${bbox});
  way["leisure"~"^(park|garden|playground)$"](${bbox});
  way["landuse"~"^(grass|recreation_ground|cemetery)$"](${bbox});
  way["water"](${bbox});
);
out geom;`

let res: Response | null = null
const failures: string[] = []
for (const url of OVERPASS) {
  res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(90_000),
  }).catch((e: Error) => {
    failures.push(`${url}: ${e.message}`)
    return null
  })
  if (res?.ok) break
  if (res) failures.push(`${url}: HTTP ${res.status}`)
}
if (!res?.ok) throw new Error(`No Overpass instance answered: ${failures.join('; ')}`)
type Way = { tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
const { elements } = (await res.json()) as { elements: Way[] }

// --- SVG ------------------------------------------------------------------------------------

const r = (n: number) => Math.round(n * 10) / 10
const pathOf = (pts: number[][]) => 'M' + pts.map(([x, y]) => `${r(x)},${r(y)}`).join('L')
const lengthOf = (pts: number[][]) =>
  pts.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - pts[i][0], y - pts[i][1]), 0)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

const roadClass = (h: string) =>
  ['primary', 'secondary'].includes(h) ? 'major' : h === 'tertiary' ? 'medium' : h === 'service' ? 'service' : 'minor'

const areas: string[] = []
const casings: string[] = []
const roads: string[] = []
const rails: string[] = []
const labels: { name: string; pts: number[][]; len: number; cls: string }[] = []

for (const el of elements) {
  if (!el.geometry?.length) continue
  const pts = el.geometry.map(project)
  const tags = el.tags ?? {}
  if (tags.highway) {
    const cls = roadClass(tags.highway)
    casings.push(`<path class="casing ${cls}" d="${pathOf(pts)}"/>`)
    roads.push(`<path class="road ${cls}" d="${pathOf(pts)}"/>`)
    if (tags.name && cls !== 'service') labels.push({ name: tags.name, pts, len: lengthOf(pts), cls })
  } else if (tags.railway) {
    rails.push(`<path class="rail" d="${pathOf(pts)}"/>`)
  } else {
    areas.push(`<path class="${tags.water ? 'water' : 'green'}" d="${pathOf(pts)}Z"/>`)
  }
}

// One label per street, on its longest piece, only where the name fits.
const best = new Map<string, (typeof labels)[number]>()
for (const l of labels) if (!best.has(l.name) || best.get(l.name)!.len < l.len) best.set(l.name, l)
const labelDefs: string[] = []
const labelUses: string[] = []
let i = 0
for (const l of best.values()) {
  const fontSize = l.cls === 'major' ? 15 : 13
  if (l.len < l.name.length * fontSize * 0.62 + 30) continue
  // Text runs left to right so it is never upside down.
  const pts = l.pts[0][0] > l.pts.at(-1)![0] ? [...l.pts].reverse() : l.pts
  const id = `s${i++}`
  labelDefs.push(`<path id="${id}" d="${pathOf(pts)}"/>`)
  labelUses.push(
    `<text class="label ${l.cls}" dy="${fontSize * 0.35}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(l.name)}</textPath></text>`,
  )
}

const px = WIDTH / 2
const py = HEIGHT / 2
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img">
<title>${esc(name)}</title>
<style>
  .bg { fill: #eef0ea }
  .green { fill: #d6e8da }
  .water { fill: #cfe0f2 }
  .casing { fill: none; stroke: #d4d8d3; stroke-linecap: round; stroke-linejoin: round }
  .road { fill: none; stroke: #ffffff; stroke-linecap: round; stroke-linejoin: round }
  .major { stroke-width: 16 } .casing.major { stroke-width: 19 }
  .medium { stroke-width: 12 } .casing.medium { stroke-width: 15 }
  .minor { stroke-width: 9 } .casing.minor { stroke-width: 11.5 }
  .service { stroke-width: 4 } .casing.service { stroke-width: 5.5 }
  .rail { fill: none; stroke: #9ba39c; stroke-width: 2.5; stroke-dasharray: 8 5 }
  .label { font: 500 13px "Segoe UI", system-ui, sans-serif; fill: #55625a; paint-order: stroke; stroke: #ffffff; stroke-width: 3px }
  .label.major { font-size: 15px; font-weight: 600 }
  .pin { fill: #1f5c3f; stroke: #ffffff; stroke-width: 3 }
  .pin-dot { fill: #ffffff }
  .name { font: 800 20px "Segoe UI", system-ui, sans-serif; fill: #1d2621; paint-order: stroke; stroke: #ffffff; stroke-width: 5px; stroke-linejoin: round }
</style>
<defs>${labelDefs.join('')}</defs>
<rect class="bg" width="${WIDTH}" height="${HEIGHT}"/>
${areas.join('\n')}
${rails.join('\n')}
${casings.join('\n')}
${roads.join('\n')}
${labelUses.join('\n')}
<path class="pin" transform="translate(${px - 22},${py - 58})" d="M22 56C22 56 3 34 3 21a19 19 0 0 1 38 0c0 13-19 35-19 35z"/>
<circle class="pin-dot" cx="${px}" cy="${py - 37}" r="7"/>
<text class="name" x="${px + 26}" y="${py - 32}">${esc(name)}</text>
</svg>
`

await mkdir('public/map', { recursive: true })
await writeFile('public/map/restaurant.svg', svg)
console.log(
  `Wrote public/map/restaurant.svg (${elements.length} OSM ways, ${labelUses.length} street labels, ${(svg.length / 1024).toFixed(0)} KB) for ${lat}, ${lng}.`,
)
process.exit(0)
