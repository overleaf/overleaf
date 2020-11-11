// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ACE_VERSION = require('ace-builds/version')
const version = {
  // Upgrade instructions: https://github.com/overleaf/write_latex/wiki/Upgrading-Ace
  ace: ACE_VERSION,
  fineuploader: '5.15.4'
}

module.exports = {
  version,

  lib(name) {
    if (version[name] != null) {
      return `${name}-${version[name]}`
    } else {
      return `${name}`
    }
  }
}
