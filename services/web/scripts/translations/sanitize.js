const sanitizeHtml = require('sanitize-html')

/**
 * Sanitize a translation string to prevent injection attacks
 *
 * @param {string} input
 * @returns {string}
 */
function sanitize(input) {
  // Block Angular XSS
  // Ticket: https://github.com/overleaf/issues/issues/4478
  input = input.replace(/'/g, '’')
  // Use left quote where (likely) appropriate.
  input.replace(/ ’/g, ' ‘')

  return sanitizeHtml(input, {
    // Allow "replacement" tags (in the format <0>, <1>, <2>, etc) used by
    // react-i18next to allow for HTML insertion via the Trans component.
    // See: https://github.com/overleaf/developer-manual/blob/master/code/translations.md
    // Unfortunately the sanitizeHtml library does not accept regexes or a
    // function for the allowedTags option, so we are limited to a hard-coded
    // number of "replacement" tags.
    allowedTags: ['b', 'strong', 'a', 'code', ...range(10)],
    allowedAttributes: {
      a: ['href', 'class'],
    },
    textFilter(text) {
      return text
        .replace(/\{\{/, '&#123;&#123;')
        .replace(/\}\}/, '&#125;&#125;')
    },
  })
}

/**
 * Generate a range of numbers as strings up to the given size
 *
 * @param {number} size Size of range
 * @returns {string[]}
 */
function range(size) {
  return Array.from(Array(size).keys()).map(n => n.toString())
}

module.exports = { sanitize }
