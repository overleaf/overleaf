/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('files', function(ide) {
    const Files = {
      getTeXFiles() {
        const texFiles = []
        ide.fileTreeManager.forEachEntity(function(entity, folder, path) {
          if (
            entity.type === 'doc' &&
            __guardMethod__(
              entity != null ? entity.name : undefined,
              'match',
              o => o.match(/.*\.(tex|txt|md)/)
            )
          ) {
            const cloned = _.clone(entity)
            cloned.path = path
            return texFiles.push(cloned)
          }
        })
        return texFiles
      }
    }

    return Files
  }))

function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}
