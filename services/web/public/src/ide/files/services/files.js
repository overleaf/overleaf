/* global _ */
define(['base'], App =>
  App.factory('files', function(ide) {
    const Files = {
      getTeXFiles() {
        let texFiles = []
        ide.fileTreeManager.forEachEntity(function(entity, _folder, path) {
          if (
            entity.type === 'doc' &&
            /.*\.(tex|md|txt|tikz)/.test(entity.name)
          ) {
            const cloned = _.clone(entity)
            cloned.path = path
            texFiles.push(cloned)
          }
        })
        return texFiles
      }
    }
    return Files
  }))
