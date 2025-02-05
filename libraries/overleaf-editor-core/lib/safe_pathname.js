// @ts-check
'use strict'

const path = require('path-browserify')

/**
 * Regular expressions for Overleaf v2 taken from
 * https://github.com/overleaf/internal/blob/f7b287b6a07354000a6b463ca3a5828104e4a811/services/web/app/src/Features/Project/SafePath.js
 */

//
// Regex of characters that are invalid in filenames
//
// eslint-disable-next-line no-control-regex
const BAD_CHAR_RX = /[/*\u0000-\u001F\u007F\u0080-\u009F\uD800-\uDFFF]/g

//
// Regex of filename patterns that are invalid ("."  ".." and leading/trailing
// whitespace)
//
const BAD_FILE_RX = /(^\.$)|(^\.\.$)|(^\s+)|(\s+$)/g

//
// Put a block on filenames which match javascript property names, as they
// can cause exceptions where the code puts filenames into a hash. This is a
// temporary workaround until the code in other places is made safe against
// property names.
//
// See https://github.com/overleaf/write_latex/wiki/Using-javascript-Objects-as-Maps
//
const BLOCKED_FILE_RX =
  /^(prototype|constructor|toString|toLocaleString|valueOf|hasOwnProperty|isPrototypeOf|propertyIsEnumerable|__defineGetter__|__lookupGetter__|__defineSetter__|__lookupSetter__|__proto__)$/

//
// Maximum path length, in characters. This is fairly arbitrary.
//
const MAX_PATH = 1024

/**
 * Replace invalid characters and filename patterns in a filename with
 * underscores.
 * @param {string} filename
 */
function cleanPart(filename) {
  filename = filename.replace(BAD_CHAR_RX, '_')
  filename = filename.replace(BAD_FILE_RX, function (match) {
    return new Array(match.length + 1).join('_')
  })
  return filename
}

/**
 * All pathnames in a Snapshot must be clean. We want pathnames that:
 *
 * 1. are unambiguous (e.g. no `.`s or redundant path separators)
 * 2. do not allow directory traversal attacks (e.g. no `..`s or absolute paths)
 * 3. do not contain leading/trailing space
 * 4. do not contain the character '*' in filenames
 *
 * We normalise the pathname, split it by the separator and then clean each part
 * as a filename
 *
 * @param {string} pathname
 * @return {String}
 */
exports.clean = function (pathname) {
  return exports.cleanDebug(pathname)[0]
}

/**
 * See clean
 * @param {string} pathname
 * @return {[string,string]}
 */
exports.cleanDebug = function (pathname) {
  let prev = pathname
  let reason = ''

  /**
   * @param {string} label
   */
  function recordReasonIfChanged(label) {
    if (pathname === prev) return
    if (reason) reason += ','
    reason += label
    prev = pathname
  }
  pathname = path.normalize(pathname)
  recordReasonIfChanged('normalize')

  pathname = pathname.replace(/\\/g, '/')
  recordReasonIfChanged('workaround for IE')

  pathname = pathname.replace(/\/+/g, '/')
  recordReasonIfChanged('no multiple slashes')

  pathname = pathname.replace(/^(\/.*)$/, '_$1')
  recordReasonIfChanged('no leading /')

  pathname = pathname.replace(/^(.+)\/$/, '$1')
  recordReasonIfChanged('no trailing /')

  pathname = pathname.replace(/^ *(.*)$/, '$1')
  recordReasonIfChanged('no leading spaces')

  pathname = pathname.replace(/^(.*[^ ]) *$/, '$1')
  recordReasonIfChanged('no trailing spaces')

  if (pathname.length === 0) pathname = '_'
  recordReasonIfChanged('empty')

  pathname = pathname.split('/').map(cleanPart).join('/')
  recordReasonIfChanged('cleanPart')

  pathname = pathname.replace(BLOCKED_FILE_RX, '@$1')
  recordReasonIfChanged('BLOCKED_FILE_RX')
  return [pathname, reason]
}

/**
 * A pathname is clean (see clean) and not too long.
 *
 * @param {string} pathname
 * @return {Boolean}
 */
exports.isClean = function pathnameIsClean(pathname) {
  return exports.isCleanDebug(pathname)[0]
}

/**
 * A pathname is clean (see clean) and not too long.
 *
 * @param {string} pathname
 * @return {[boolean,string]}
 */
exports.isCleanDebug = function (pathname) {
  if (pathname.length > MAX_PATH) return [false, 'MAX_PATH']
  if (pathname.length === 0) return [false, 'empty']
  const [cleanPathname, reason] = exports.cleanDebug(pathname)
  if (cleanPathname !== pathname) return [false, reason]
  return [true, '']
}
