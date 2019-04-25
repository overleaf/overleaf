/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
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
define([], function() {
  let ColorManager
  return (ColorManager = {
    getColorScheme(hue, element) {
      if (this.isDarkTheme(element)) {
        return {
          cursor: `hsl(${hue}, 70%, 50%)`,
          labelBackgroundColor: `hsl(${hue}, 70%, 50%)`,
          highlightBackgroundColor: `hsl(${hue}, 100%, 28%);`,
          strikeThroughBackgroundColor: `hsl(${hue}, 100%, 20%);`,
          strikeThroughForegroundColor: `hsl(${hue}, 100%, 60%);`
        }
      } else {
        return {
          cursor: `hsl(${hue}, 70%, 50%)`,
          labelBackgroundColor: `hsl(${hue}, 70%, 50%)`,
          highlightBackgroundColor: `hsl(${hue}, 70%, 85%);`,
          strikeThroughBackgroundColor: `hsl(${hue}, 70%, 95%);`,
          strikeThroughForegroundColor: `hsl(${hue}, 70%, 40%);`
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

    OWN_HUE: 200, // We will always appear as this color to ourselves
    ANONYMOUS_HUE: 100,
    getHueForUserId(user_id) {
      if (user_id == null || user_id === 'anonymous-user') {
        return this.ANONYMOUS_HUE
      }

      if (window.user.id === user_id) {
        return this.OWN_HUE
      }

      hue = this.getHueForId(user_id)
      // Avoid 20 degrees either side of the personal hue
      if (hue > this.OWNER_HUE - 20) {
        hue = hue + 40
      }
      return hue
    },

    getHueForTagId(tag_id) {
      return this.getHueForId(tag_id)
    },

    getHueForId(id) {
      const hash = CryptoJS.MD5(id)
      let hue = parseInt(hash.toString().slice(0, 8), 16) % 320
      return hue
    }
  })
})
