/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let StringHelper
const JSON_ESCAPE_REGEXP = /[\u2028\u2029&><]/g

const JSON_ESCAPE = {
  '&': '\\u0026',
  '>': '\\u003e',
  '<': '\\u003c',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

/**
 * Converts a snake_case string into a user friendly string with each word capitalized.
 * @param {string} snakecaseStr
 * @returns {string}
 */
export function wordifySnakecase(snakecaseStr) {
  return snakecaseStr
    .split('_')
    .map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export default StringHelper = {
  // stringifies and escapes a json object for use in a script. This ensures that &, < and > characters are escaped,
  // along with quotes. This ensures that the string can be safely rendered into HTML. See rationale at:
  // https://api.rubyonrails.org/classes/ERB/Util.html#method-c-json_escape
  // and implementation lifted from:
  // https://github.com/ember-fastboot/fastboot/blob/cafd96c48564d8384eb83dc908303dba8ece10fd/src/ember-app.js#L496-L510
  stringifyJsonForScript(object) {
    return JSON.stringify(object).replace(
      JSON_ESCAPE_REGEXP,
      match => JSON_ESCAPE[match]
    )
  },
}
