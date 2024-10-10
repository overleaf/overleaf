// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import _ from 'lodash'

export default {
  areSame(lines1, lines2) {
    if (!Array.isArray(lines1) || !Array.isArray(lines2)) {
      return false
    }

    return _.isEqual(lines1, lines2)
  },
}
