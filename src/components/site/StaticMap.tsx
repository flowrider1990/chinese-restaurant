import { existsSync } from 'fs'
import Image from 'next/image'
import path from 'path'
import { Icon } from './Icon'

const FILE = 'map/restaurant.svg'
const DARK_FILE = 'map/restaurant-dark.svg'

/**
 * Map drawn from OpenStreetMap data at build time (pnpm map:generate) and served from this site,
 * so viewing it contacts no third party. Google Maps and Apple Maps are only links.
 */
export function StaticMap({
  alt,
  mapsUrl,
  appleMapsUrl,
  labels,
}: {
  alt: string
  mapsUrl: string
  appleMapsUrl: string
  labels: { open: string; openApple: string; attribution: string; external: string }
}) {
  const exists = existsSync(path.join(process.cwd(), 'public', FILE))

  return (
    <figure className="map">
      {exists && (
        <>
          <Image
            src={`/${FILE}`}
            alt={alt}
            width={1200}
            height={600}
            unoptimized
            className="map__image map__image--light"
          />
          <Image
            src={`/${DARK_FILE}`}
            alt={alt}
            width={1200}
            height={600}
            unoptimized
            className="map__image map__image--dark"
          />
        </>
      )}
      <figcaption className="map__caption">
        <span className="map__links">
          <a className="btn btn--outline" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            {labels.open}
            <Icon name="external" size={16} />
            <span className="visually-hidden"> {labels.external}</span>
          </a>
          <a
            className="btn btn--outline"
            href={appleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {labels.openApple}
            <Icon name="external" size={16} />
            <span className="visually-hidden"> {labels.external}</span>
          </a>
        </span>
        {exists && (
          <small>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              {labels.attribution}
            </a>
          </small>
        )}
      </figcaption>
    </figure>
  )
}
