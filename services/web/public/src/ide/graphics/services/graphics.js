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
  App.factory('graphics', function(ide) {
    const Graphics = {
      getGraphicsFiles() {
        const graphicsFiles = []
        ide.fileTreeManager.forEachEntity(function(entity, folder, path) {
          if (
            entity.type === 'file' &&
            __guardMethod__(
              entity != null ? entity.name : undefined,
              'match',
              o => o.match(/.*\.(png|jpg|jpeg|pdf|eps)/i)
            )
          ) {
            const cloned = _.clone(entity)
            cloned.path = path
            return graphicsFiles.push(cloned)
          }
        })
        return graphicsFiles
      }
    }

    return Graphics
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
