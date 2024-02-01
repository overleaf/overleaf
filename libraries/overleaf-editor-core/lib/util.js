/*
 * Misc functions
 */

'use strict'

/**
 * @param {string} str
 * @returns {boolean} true if the given string contains non-BMP chars otherwise false
 */
exports.containsNonBmpChars = function utilContainsNonBmpChars(str) {
  // check for first (high) surrogate in a non-BMP character
  return /[\uD800-\uDBFF]/.test(str)
}
