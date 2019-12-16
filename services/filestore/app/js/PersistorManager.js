// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

// assume s3 if none specified
__guard__(
  settings != null ? settings.filestore : undefined,
  x => x.backend || (settings.filestore.backend = 's3')
)

logger.log(
  {
    backend: __guard__(
      settings != null ? settings.filestore : undefined,
      x1 => x1.backend
    )
  },
  'Loading backend'
)
module.exports = (() => {
  switch (
    __guard__(
      settings != null ? settings.filestore : undefined,
      x2 => x2.backend
    )
  ) {
    case 'aws-sdk':
      return require('./AWSSDKPersistorManager')
    case 's3':
      return require('./S3PersistorManager')
    case 'fs':
      return require('./FSPersistorManager')
    default:
      throw new Error(
        `Unknown filestore backend: ${settings.filestore.backend}`
      )
  }
})()

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
