import { generateMD5Hash } from './md5'

const ANONYMOUS_HUE = 100
const OWN_HUE = 200 // We will always appear as this color to ourselves
const OWN_HUE_BLOCKED_SIZE = 20 // no other user should have a HUE in this range
const TOTAL_HUES = 360 // actually 361, but 360 for legacy reasons

export function getHueForUserId(userId, currentUserId) {
  if (userId == null || userId === 'anonymous-user') {
    return ANONYMOUS_HUE
  }

  if (currentUserId === userId) {
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

function getHueForId(id) {
  const hash = generateMD5Hash(id)
  const hue =
    parseInt(hash.toString().slice(0, 8), 16) %
    (TOTAL_HUES - OWN_HUE_BLOCKED_SIZE * 2)
  return hue
}
