'use client'

import { useState } from 'react'
import { Icon } from './Icon'

type Props = {
  query: string
  mapsUrl: string
  labels: { title: string; notice: string; load: string; open: string; frameTitle: string; external: string }
}

/**
 * Two-click map: nothing is requested from Google until the visitor presses "Load map".
 * The plain link to Google Maps works without loading anything on this page.
 */
export function MapConsent({ query, mapsUrl, labels }: Props) {
  const [loaded, setLoaded] = useState(false)

  if (loaded) {
    return (
      <div className="map map--loaded">
        <iframe
          title={labels.frameTitle}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    )
  }

  return (
    <div className="map">
      <div className="map__placeholder">
        <p>{labels.notice}</p>
        <div className="hero__actions">
          <button type="button" className="btn btn--primary" onClick={() => setLoaded(true)}>
            {labels.load}
          </button>
          <a className="btn btn--outline" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            {labels.open}
            <Icon name="external" size={16} />
            <span className="visually-hidden"> {labels.external}</span>
          </a>
        </div>
      </div>
    </div>
  )
}
