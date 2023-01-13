/*
 * Misc functions
 */

'use strict'

/*
 * return true/false if the given string contains non-BMP chars
 */
exports.containsNonBmpChars = function utilContainsNonBmpChars(str) {
  // check for first (high) surrogate in a non-BMP character
  return /[\uD800-\uDBFF]/.test(str)
}
