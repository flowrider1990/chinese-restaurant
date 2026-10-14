import { existsSync } from 'fs'
import Image from 'next/image'
import path from 'path'
import { Icon } from './Icon'

const FILE = 'map/restaurant.svg'

/**
 * Map drawn from OpenStreetMap data at build time (pnpm map:generate) and served from this site,
 * so viewing it contacts no third party. Google Maps is only a link.
 */
export function StaticMap({
  alt,
  mapsUrl,
  labels,
}: {
  alt: string
  mapsUrl: string
  labels: { open: string; attribution: string; external: string }
}) {
  const exists = existsSync(path.join(process.cwd(), 'public', FILE))

  return (
    <figure className="map">
      {exists && <Image src={`/${FILE}`} alt={alt} width={1200} height={600} unoptimized className="map__image" />}
      <figcaption className="map__caption">
        <a className="btn btn--outline" href={mapsUrl} target="_blank" rel="noopener noreferrer">
          {labels.open}
          <Icon name="external" size={16} />
          <span className="visually-hidden"> {labels.external}</span>
        </a>
        {exists && (
          <small>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              {labels.attribution}
            </a>
          </small>
        )}
      </figcaption>
    </figure>
  )
}
