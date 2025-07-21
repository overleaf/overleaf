import { generateMD5Hash } from './md5'
import getMeta from '@/utils/meta'

const ANONYMOUS_HUE = 100
const OWN_HUE = 200 // We will always appear as this color to ourselves
const OWN_HUE_BLOCKED_SIZE = 20 // no other user should have a HUE in this range
const TOTAL_HUES = 360 // actually 361, but 360 for legacy reasons

export function getHueForUserId(userId?: string): number {
  if (userId == null || userId === 'anonymous-user') {
    return ANONYMOUS_HUE
  }

  if (getMeta('ol-user_id') === userId) {
    return OWN_HUE
  }

  let hue = getHueForId(userId)

  // if `hue` is within `OWN_HUE_BLOCKED_SIZE` degrees of the personal hue
  // (`OWN_HUE`), shift `hue` to the end of available hues by adding
  if (
    hue > OWN_HUE - OWN_HUE_BLOCKED_SIZE &&
    hue < OWN_HUE + OWN_HUE_BLOCKED_SIZE
  ) {
    hue = hue - OWN_HUE // `hue` now at 0 +/- `OWN_HUE_BLOCKED_SIZE`
    hue = hue + TOTAL_HUES - OWN_HUE_BLOCKED_SIZE
  }

  return hue
}

export function getBackgroundColorForUserId(userId?: string) {
  return `hsl(${getHueForUserId(userId)}, 70%, 50%)`
}

export function hslStringToLuminance(hslString: string): number {
  // First extract the individual components from the HSL string
  const hslSplit = hslString.slice(4).split(')')[0].split(',')

  const h = Number(hslSplit[0])
  const s = Number(hslSplit[1].slice(0, -1)) / 100
  const l = Number(hslSplit[2].slice(0, -1)) / 100

  // Then we need to convert HSL to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h >= 0 && h < 60) {
    r = c + m
    g = x + m
    b = m
  } else if (h >= 60 && h < 120) {
    r = x + m
    g = c + m
    b = m
  } else if (h >= 120 && h < 180) {
    r = m
    g = c + m
    b = x + m
  } else if (h >= 180 && h < 240) {
    r = m
    g = x + m
    b = c + m
  } else if (h >= 240 && h < 300) {
    r = x + m
    g = m
    b = c + m
  } else if (h >= 300 && h < 360) {
    r = c + m
    g = m
    b = x + m
  }

  // Finally we calculate the luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const cachedHues = new Map()

export function getHueForId(id: string) {
  if (cachedHues.has(id)) {
    return cachedHues.get(id)
  }

  const hash = generateMD5Hash(id)

  const hue =
    parseInt(hash.slice(0, 8), 16) % (TOTAL_HUES - OWN_HUE_BLOCKED_SIZE * 2)

  cachedHues.set(id, hue)

  return hue
}
