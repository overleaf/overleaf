/* eslint-disable
    max-len,
    no-return-assign,
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
// This file is shared between the frontend and server code of web, so that
// filename validation is the same in both implementations.
// Both copies must be kept in sync:
//   app/coffee/Features/Project/SafePath.coffee
//   public/coffee/ide/directives/SafePath.coffee

const load = function() {
  let SafePath
  const BADCHAR_RX = new RegExp(
    `\
[\
\\/\
\\\\\
\\*\
\\u0000-\\u001F\
\\u007F\
\\u0080-\\u009F\
\\uD800-\\uDFFF\
]\
`,
    'g'
  )

  const BADFILE_RX = new RegExp(
    `\
(^\\.$)\
|(^\\.\\.$)\
|(^\\s+)\
|(\\s+$)\
`,
    'g'
  )

  // Put a block on filenames which match javascript property names, as they
  // can cause exceptions where the code puts filenames into a hash. This is a
  // temporary workaround until the code in other places is made safe against
  // property names.
  //
  // The list of property names is taken from
  //   ['prototype'].concat(Object.getOwnPropertyNames(Object.prototype))
  const BLOCKEDFILE_RX = new RegExp(`\
^(\
prototype\
|constructor\
|toString\
|toLocaleString\
|valueOf\
|hasOwnProperty\
|isPrototypeOf\
|propertyIsEnumerable\
|__defineGetter__\
|__lookupGetter__\
|__defineSetter__\
|__lookupSetter__\
|__proto__\
)$\
`)

  const MAX_PATH = 1024 // Maximum path length, in characters. This is fairly arbitrary.

  return (SafePath = {
    // convert any invalid characters to underscores in the given filename
    clean(filename) {
      filename = filename.replace(BADCHAR_RX, '_')
      // for BADFILE_RX replace any matches with an equal number of underscores
      filename = filename.replace(BADFILE_RX, match =>
        new Array(match.length + 1).join('_')
      )
      // replace blocked filenames 'prototype' with '@prototype'
      filename = filename.replace(BLOCKEDFILE_RX, '@$1')
      return filename
    },

    // returns whether the filename is 'clean' (does not contain any invalid
    // characters or reserved words)
    isCleanFilename(filename) {
      return (
        SafePath.isAllowedLength(filename) &&
        !BADCHAR_RX.test(filename) &&
        !BADFILE_RX.test(filename)
      )
    },

    isBlockedFilename(filename) {
      return BLOCKEDFILE_RX.test(filename)
    },

    // returns whether a full path is 'clean' - e.g. is a full or relative path
    // that points to a file, and each element passes the rules in 'isCleanFilename'
    isCleanPath(path) {
      const elements = path.split('/')

      const lastElementIsEmpty = elements[elements.length - 1].length === 0
      if (lastElementIsEmpty) {
        return false
      }

      for (let element of Array.from(elements)) {
        if (element.length > 0 && !SafePath.isCleanFilename(element)) {
          return false
        }
      }

      // check for a top-level reserved name
      if (BLOCKEDFILE_RX.test(path.replace(/^\/?/, ''))) {
        return false
      } // remove leading slash if present

      return true
    },

    isAllowedLength(pathname) {
      return pathname.length > 0 && pathname.length <= MAX_PATH
    }
  })
}

if (typeof define !== 'undefined' && define !== null) {
  define([], load)
} else {
  module.exports = load()
}
