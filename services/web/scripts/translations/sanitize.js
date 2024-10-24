import sanitizeHtml from 'sanitize-html'

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

  // Allow "replacement" tags (in the format <0>, <1>, <2>, etc) used by
  // react-i18next to allow for HTML insertion via the Trans component.
  // See: https://github.com/overleaf/developer-manual/blob/master/code/translations.md
  // The html parser of sanitize-html is only accepting ASCII alpha characters
  //  at the start of HTML tags. So we need to replace these ahead of parsing
  //  and restore them afterwards.
  input = input.replaceAll(/<([/]?[0-9])>/g, '&lt;$1&gt;')

  return (
    sanitizeHtml(input, {
      allowedTags: ['b', 'strong', 'a', 'code'],
      allowedAttributes: {
        a: ['href', 'class'],
      },
      textFilter(text) {
        // Block Angular XSS
        if (text === '{') return '&#123;'
        if (text === '}') return '&#125;'
        return text
          .replace(/\{\{/, '&#123;&#123;')
          .replace(/\}\}/, '&#125;&#125;')
      },
    })
      // Restore the escaping again.
      .replaceAll(/&lt;([/]?[0-9])&gt;/g, '<$1>')
      // Restore escaped standalone ampersands
      .replaceAll(/ &amp; /g, ' & ')
  )
}

export default { sanitize }
