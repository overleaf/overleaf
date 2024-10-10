/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import _ from 'lodash'

const extensionsToProxy = [
  '.png',
  '.xml',
  '.jpeg',
  '.json',
  '.zip',
  '.eps',
  '.gif',
  '.jpg',
]

export default {
  shouldProxy(url) {
    const shouldProxy = _.find(
      extensionsToProxy,
      extension => url.indexOf(extension) !== -1
    )
    return shouldProxy
  },
}
