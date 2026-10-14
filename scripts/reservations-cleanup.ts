/** Removes personal data from expired reservations. Usage: pnpm reservations:cleanup */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { anonymiseExpiredReservations } from '../src/lib/reservation-cleanup'

const payload = await getPayload({ config })
const count = await anonymiseExpiredReservations(payload)
console.log(`Anonymised ${count} reservation(s).`)
process.exit(0)
