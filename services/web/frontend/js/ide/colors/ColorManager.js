/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

// NOTE: this file is being refactored over to frontend/js/shared/utils/colors.js

import { generateMD5Hash } from './../../shared/utils/md5'
import getMeta from '@/utils/meta'

let ColorManager

export default ColorManager = {
  getColorScheme(hue, element) {
    if (this.isDarkTheme(element)) {
      return {
        cursor: `hsl(${hue}, 70%, 50%)`,
        labelBackgroundColor: `hsl(${hue}, 70%, 50%)`,
        highlightBackgroundColor: `hsl(${hue}, 100%, 28%);`,
        strikeThroughBackgroundColor: `hsl(${hue}, 100%, 20%);`,
        strikeThroughForegroundColor: `hsl(${hue}, 100%, 60%);`,
      }
    } else {
      return {
        cursor: `hsl(${hue}, 70%, 50%)`,
        labelBackgroundColor: `hsl(${hue}, 70%, 50%)`,
        highlightBackgroundColor: `hsl(${hue}, 70%, 85%);`,
        strikeThroughBackgroundColor: `hsl(${hue}, 70%, 95%);`,
        strikeThroughForegroundColor: `hsl(${hue}, 70%, 40%);`,
      }
    }
  },

  isDarkTheme(element) {
    const rgb = element.find('.ace_editor').css('background-color')
    let [m, r, g, b] = Array.from(
      rgb.match(/rgb\(([0-9]+), ([0-9]+), ([0-9]+)\)/)
    )
    r = parseInt(r, 10)
    g = parseInt(g, 10)
    b = parseInt(b, 10)
    return r + g + b < 3 * 128
  },

  ANONYMOUS_HUE: 100,
  OWN_HUE: 200, // We will always appear as this color to ourselves
  OWN_HUE_BLOCKED_SIZE: 20, // no other user should havea HUE in this range
  TOTAL_HUES: 360, // actually 361, but 360 for legacy reasons
  getHueForUserId(user_id) {
    if (user_id == null || user_id === 'anonymous-user') {
      return this.ANONYMOUS_HUE
    }

    if (getMeta('ol-user').id === user_id) {
      return this.OWN_HUE
    }

    let hue = this.getHueForId(user_id)

    // if `hue` is within `OWN_HUE_BLOCKED_SIZE` degrees of the personal hue
    // (`OWN_HUE`), shift `hue` to the end of available hues by adding
    if (
      hue > this.OWN_HUE - this.OWN_HUE_BLOCKED_SIZE &&
      hue < this.OWN_HUE + this.OWN_HUE_BLOCKED_SIZE
    ) {
      hue = hue - this.OWN_HUE // `hue` now at 0 +/- `OWN_HUE_BLOCKED_SIZE`
      hue = hue + this.TOTAL_HUES - this.OWN_HUE_BLOCKED_SIZE
    }

    return hue
  },

  getHueForTagId(tag_id) {
    return this.getHueForId(tag_id)
  },

  getHueForId(id) {
    const hash = generateMD5Hash(id)
    const hue =
      parseInt(hash.toString().slice(0, 8), 16) %
      (this.TOTAL_HUES - this.OWN_HUE_BLOCKED_SIZE * 2)
    return hue
  },
}
