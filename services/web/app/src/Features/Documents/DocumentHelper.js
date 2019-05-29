/* eslint-disable
    max-len,
    no-cond-assign,
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
let DocumentHelper
module.exports = DocumentHelper = {
  getTitleFromTexContent(content, maxContentToScan) {
    if (maxContentToScan == null) {
      maxContentToScan = 30000
    }
    const TITLE_WITH_CURLY_BRACES = /\\[tT]itle\*?\s*{([^}]+)}/
    const TITLE_WITH_SQUARE_BRACES = /\\[tT]itle\s*\[([^\]]+)\]/
    for (let line of Array.from(
      DocumentHelper._getLinesFromContent(content, maxContentToScan)
    )) {
      var match
      if (
        (match =
          line.match(TITLE_WITH_CURLY_BRACES) ||
          line.match(TITLE_WITH_SQUARE_BRACES))
      ) {
        return DocumentHelper.detex(match[1])
      }
    }

    return null
  },

  contentHasDocumentclass(content, maxContentToScan) {
    if (maxContentToScan == null) {
      maxContentToScan = 30000
    }
    for (let line of Array.from(
      DocumentHelper._getLinesFromContent(content, maxContentToScan)
    )) {
      // We've had problems with this regex locking up CPU.
      // Previously /.*\\documentclass/ would totally lock up on lines of 500kb (data text files :()
      // This regex will only look from the start of the line, including whitespace so will return quickly
      // regardless of line length.
      if (line.match(/^\s*\\documentclass/)) {
        return true
      }
    }

    return false
  },

  detex(string) {
    return string
      .replace(/\\LaTeX/g, 'LaTeX')
      .replace(/\\TeX/g, 'TeX')
      .replace(/\\TikZ/g, 'TikZ')
      .replace(/\\BibTeX/g, 'BibTeX')
      .replace(/\\\[[A-Za-z0-9. ]*\]/g, ' ') // line spacing
      .replace(/\\(?:[a-zA-Z]+|.|)/g, '')
      .replace(/{}|~/g, ' ')
      .replace(/[${}]/g, '')
      .replace(/ +/g, ' ')
      .trim()
  },

  _getLinesFromContent(content, maxContentToScan) {
    if (typeof content === 'string') {
      return content.substring(0, maxContentToScan).split('\n')
    } else {
      return content
    }
  }
}
