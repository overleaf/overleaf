/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-dupe-class-members,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'ide/file-tree/directives/fileEntity',
  'ide/file-tree/directives/draggable',
  'ide/file-tree/directives/droppable',
  'ide/file-tree/controllers/FileTreeController',
  'ide/file-tree/controllers/FileTreeEntityController',
  'ide/file-tree/controllers/FileTreeFolderController',
  'ide/file-tree/controllers/FileTreeRootFolderController'
], function() {
  let FileTreeManager
  return (FileTreeManager = class FileTreeManager {
    constructor(ide, $scope) {
      this.ide = ide
      this.$scope = $scope
      this.$scope.$on('project:joined', () => {
        this.loadRootFolder()
        this.loadDeletedDocs()
        return this.$scope.$emit('file-tree:initialized')
      })

      this.$scope.$watch('rootFolder', rootFolder => {
        if (rootFolder != null) {
          return this.recalculateDocList()
        }
      })

      this._bindToSocketEvents()

      this.$scope.multiSelectedCount = 0

      $(document).on('click', () => {
        this.clearMultiSelectedEntities()
        return this.$scope.$digest()
      })
    }

    _bindToSocketEvents() {
      this.ide.socket.on('reciveNewDoc', (parent_folder_id, doc) => {
        const parent_folder =
          this.findEntityById(parent_folder_id) || this.$scope.rootFolder
        return this.$scope.$apply(() => {
          parent_folder.children.push({
            name: doc.name,
            id: doc._id,
            type: 'doc'
          })
          return this.recalculateDocList()
        })
      })

      this.ide.socket.on(
        'reciveNewFile',
        (parent_folder_id, file, source, linkedFileData) => {
          const parent_folder =
            this.findEntityById(parent_folder_id) || this.$scope.rootFolder
          return this.$scope.$apply(() => {
            parent_folder.children.push({
              name: file.name,
              id: file._id,
              type: 'file',
              linkedFileData,
              created: file.created
            })
            return this.recalculateDocList()
          })
        }
      )

      this.ide.socket.on('reciveNewFolder', (parent_folder_id, folder) => {
        const parent_folder =
          this.findEntityById(parent_folder_id) || this.$scope.rootFolder
        return this.$scope.$apply(() => {
          parent_folder.children.push({
            name: folder.name,
            id: folder._id,
            type: 'folder',
            children: []
          })
          return this.recalculateDocList()
        })
      })

      this.ide.socket.on('reciveEntityRename', (entity_id, name) => {
        const entity = this.findEntityById(entity_id)
        if (entity == null) {
          return
        }
        return this.$scope.$apply(() => {
          entity.name = name
          return this.recalculateDocList()
        })
      })

      this.ide.socket.on('removeEntity', entity_id => {
        const entity = this.findEntityById(entity_id)
        if (entity == null) {
          return
        }
        this.$scope.$apply(() => {
          this._deleteEntityFromScope(entity)
          return this.recalculateDocList()
        })
        return this.$scope.$broadcast('entity:deleted', entity)
      })

      return this.ide.socket.on('reciveEntityMove', (entity_id, folder_id) => {
        const entity = this.findEntityById(entity_id)
        const folder = this.findEntityById(folder_id)
        return this.$scope.$apply(() => {
          this._moveEntityInScope(entity, folder)
          return this.recalculateDocList()
        })
      })
    }

    selectEntity(entity) {
      this.selected_entity_id = entity.id // For reselecting after a reconnect
      this.ide.fileTreeManager.forEachEntity(
        entity => (entity.selected = false)
      )
      return (entity.selected = true)
    }

    toggleMultiSelectEntity(entity) {
      entity.multiSelected = !entity.multiSelected
      return (this.$scope.multiSelectedCount = this.multiSelectedCount())
    }

    multiSelectedCount() {
      let count = 0
      this.forEachEntity(function(entity) {
        if (entity.multiSelected) {
          return count++
        }
      })
      return count
    }

    getMultiSelectedEntities() {
      const entities = []
      this.forEachEntity(function(e) {
        if (e.multiSelected) {
          return entities.push(e)
        }
      })
      return entities
    }

    getMultiSelectedEntityChildNodes() {
      // use pathnames with a leading slash to avoid
      // problems with reserved Object properties
      const entities = this.getMultiSelectedEntities()
      const paths = {}
      for (var entity of Array.from(entities)) {
        paths['/' + this.getEntityPath(entity)] = entity
      }
      const prefixes = {}
      for (var path in paths) {
        entity = paths[path]
        const parts = path.split('/')
        if (parts.length <= 2) {
          continue
        } else {
          // Record prefixes a/b/c.tex -> 'a' and 'a/b'
          for (
            let i = 1, end = parts.length - 1, asc = end >= 1;
            asc ? i <= end : i >= end;
            asc ? i++ : i--
          ) {
            prefixes['/' + parts.slice(0, i).join('/')] = true
          }
        }
      }
      const child_entities = []
      for (path in paths) {
        // If the path is in the prefixes, then it's a parent folder and
        // should be ignore
        entity = paths[path]
        if (prefixes[path] == null) {
          child_entities.push(entity)
        }
      }
      return child_entities
    }

    clearMultiSelectedEntities() {
      if (this.$scope.multiSelectedCount === 0) {
        return
      } // Be efficient, this is called a lot on 'click'
      this.forEachEntity(entity => (entity.multiSelected = false))
      return (this.$scope.multiSelectedCount = 0)
    }

    multiSelectSelectedEntity() {
      return __guard__(this.findSelectedEntity(), x => (x.multiSelected = true))
    }

    existsInFolder(folder_id, name) {
      const folder = this.findEntityById(folder_id)
      if (folder == null) {
        return false
      }
      const entity = this._findEntityByPathInFolder(folder, name)
      return entity != null
    }

    findSelectedEntity() {
      let selected = null
      this.forEachEntity(function(entity) {
        if (entity.selected) {
          return (selected = entity)
        }
      })
      return selected
    }

    findEntityById(id, options) {
      if (options == null) {
        options = {}
      }
      if (this.$scope.rootFolder.id === id) {
        return this.$scope.rootFolder
      }

      let entity = this._findEntityByIdInFolder(this.$scope.rootFolder, id)
      if (entity != null) {
        return entity
      }

      if (options.includeDeleted) {
        for (entity of Array.from(this.$scope.deletedDocs)) {
          if (entity.id === id) {
            return entity
          }
        }
      }

      return null
    }

    _findEntityByIdInFolder(folder, id) {
      for (let entity of Array.from(folder.children || [])) {
        if (entity.id === id) {
          return entity
        } else if (entity.children != null) {
          const result = this._findEntityByIdInFolder(entity, id)
          if (result != null) {
            return result
          }
        }
      }

      return null
    }

    findEntityByPath(path) {
      return this._findEntityByPathInFolder(this.$scope.rootFolder, path)
    }

    _findEntityByPathInFolder(folder, path) {
      if (path == null || folder == null) {
        return null
      }
      if (path === '') {
        return folder
      }

      const parts = path.split('/')
      const name = parts.shift()
      const rest = parts.join('/')

      if (name === '.') {
        return this._findEntityByPathInFolder(folder, rest)
      }

      for (let entity of Array.from(folder.children)) {
        if (entity.name === name) {
          if (rest === '') {
            return entity
          } else if (entity.type === 'folder') {
            return this._findEntityByPathInFolder(entity, rest)
          }
        }
      }
      return null
    }

    forEachEntity(callback) {
      if (callback == null) {
        callback = function(entity, parent_folder, path) {}
      }
      this._forEachEntityInFolder(this.$scope.rootFolder, null, callback)

      return (() => {
        const result = []
        for (let entity of Array.from(this.$scope.deletedDocs || [])) {
          result.push(callback(entity))
        }
        return result
      })()
    }

    _forEachEntityInFolder(folder, path, callback) {
      return (() => {
        const result = []
        for (let entity of Array.from(folder.children || [])) {
          var childPath
          if (path != null) {
            childPath = path + '/' + entity.name
          } else {
            childPath = entity.name
          }
          callback(entity, folder, childPath)
          if (entity.children != null) {
            result.push(
              this._forEachEntityInFolder(entity, childPath, callback)
            )
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    }

    getEntityPath(entity) {
      return this._getEntityPathInFolder(this.$scope.rootFolder, entity)
    }

    _getEntityPathInFolder(folder, entity) {
      for (let child of Array.from(folder.children || [])) {
        if (child === entity) {
          return entity.name
        } else if (child.type === 'folder') {
          const path = this._getEntityPathInFolder(child, entity)
          if (path != null) {
            return child.name + '/' + path
          }
        }
      }
      return null
    }

    getRootDocDirname() {
      const rootDoc = this.findEntityById(this.$scope.project.rootDoc_id)
      if (rootDoc == null) {
        return
      }
      return this._getEntityDirname(rootDoc)
    }

    _getEntityDirname(entity) {
      const path = this.getEntityPath(entity)
      if (path == null) {
        return
      }
      return path
        .split('/')
        .slice(0, -1)
        .join('/')
    }

    _findParentFolder(entity) {
      const dirname = this._getEntityDirname(entity)
      if (dirname == null) {
        return
      }
      return this.findEntityByPath(dirname)
    }

    loadRootFolder() {
      return (this.$scope.rootFolder = this._parseFolder(
        __guard__(
          this.$scope != null ? this.$scope.project : undefined,
          x => x.rootFolder[0]
        )
      ))
    }

    _parseFolder(rawFolder) {
      const folder = {
        name: rawFolder.name,
        id: rawFolder._id,
        type: 'folder',
        children: [],
        selected: rawFolder._id === this.selected_entity_id
      }

      for (let doc of Array.from(rawFolder.docs || [])) {
        folder.children.push({
          name: doc.name,
          id: doc._id,
          type: 'doc',
          selected: doc._id === this.selected_entity_id
        })
      }

      for (let file of Array.from(rawFolder.fileRefs || [])) {
        folder.children.push({
          name: file.name,
          id: file._id,
          type: 'file',
          selected: file._id === this.selected_entity_id,
          linkedFileData: file.linkedFileData,
          created: file.created
        })
      }

      for (let childFolder of Array.from(rawFolder.folders || [])) {
        folder.children.push(this._parseFolder(childFolder))
      }

      return folder
    }

    loadDeletedDocs() {
      this.$scope.deletedDocs = []
      return Array.from(this.$scope.project.deletedDocs || []).map(doc =>
        this.$scope.deletedDocs.push({
          name: doc.name,
          id: doc._id,
          type: 'doc',
          deleted: true
        })
      )
    }

    recalculateDocList() {
      this.$scope.docs = []
      this.forEachEntity((entity, parentFolder, path) => {
        if (entity.type === 'doc' && !entity.deleted) {
          return this.$scope.docs.push({
            doc: entity,
            path
          })
        }
      })
      // Keep list ordered by folders, then name
      return this.$scope.docs.sort(function(a, b) {
        const aDepth = (a.path.match(/\//g) || []).length
        const bDepth = (b.path.match(/\//g) || []).length
        if (aDepth - bDepth !== 0) {
          return -(aDepth - bDepth) // Deeper path == folder first
        } else if (a.path < b.path) {
          return -1
        } else {
          return 1
        }
      })
    }

    getEntityPath(entity) {
      return this._getEntityPathInFolder(this.$scope.rootFolder, entity)
    }

    _getEntityPathInFolder(folder, entity) {
      for (let child of Array.from(folder.children || [])) {
        if (child === entity) {
          return entity.name
        } else if (child.type === 'folder') {
          const path = this._getEntityPathInFolder(child, entity)
          if (path != null) {
            return child.name + '/' + path
          }
        }
      }
      return null
    }

    getCurrentFolder() {
      // Return the root folder if nothing is selected
      return (
        this._getCurrentFolder(this.$scope.rootFolder) || this.$scope.rootFolder
      )
    }

    _getCurrentFolder(startFolder) {
      if (startFolder == null) {
        startFolder = this.$scope.rootFolder
      }
      for (let entity of Array.from(startFolder.children || [])) {
        // The 'current' folder is either the one selected, or
        // the one containing the selected doc/file
        if (entity.selected) {
          if (entity.type === 'folder') {
            return entity
          } else {
            return startFolder
          }
        }

        if (entity.type === 'folder') {
          const result = this._getCurrentFolder(entity)
          if (result != null) {
            return result
          }
        }
      }

      return null
    }

    projectContainsFolder() {
      for (let entity of Array.from(this.$scope.rootFolder.children)) {
        if (entity.type === 'folder') {
          return true
        }
      }
      return false
    }

    existsInThisFolder(folder, name) {
      for (let entity of Array.from(
        (folder != null ? folder.children : undefined) || []
      )) {
        if (entity.name === name) {
          return true
        }
      }
      return false
    }

    nameExistsError(message) {
      if (message == null) {
        message = 'already exists'
      }
      const nameExists = this.ide.$q.defer()
      nameExists.reject({ data: message })
      return nameExists.promise
    }

    createDoc(name, parent_folder) {
      // check if a doc/file/folder already exists with this name
      if (parent_folder == null) {
        parent_folder = this.getCurrentFolder()
      }
      if (this.existsInThisFolder(parent_folder, name)) {
        return this.nameExistsError()
      }
      // We'll wait for the socket.io notification to actually
      // add the doc for us.
      return this.ide.$http.post(`/project/${this.ide.project_id}/doc`, {
        name,
        parent_folder_id: parent_folder != null ? parent_folder.id : undefined,
        _csrf: window.csrfToken
      })
    }

    createFolder(name, parent_folder) {
      // check if a doc/file/folder already exists with this name
      if (parent_folder == null) {
        parent_folder = this.getCurrentFolder()
      }
      if (this.existsInThisFolder(parent_folder, name)) {
        return this.nameExistsError()
      }
      // We'll wait for the socket.io notification to actually
      // add the folder for us.
      return this.ide.$http.post(`/project/${this.ide.project_id}/folder`, {
        name,
        parent_folder_id: parent_folder != null ? parent_folder.id : undefined,
        _csrf: window.csrfToken
      })
    }

    createLinkedFile(name, parent_folder, provider, data) {
      // check if a doc/file/folder already exists with this name
      if (parent_folder == null) {
        parent_folder = this.getCurrentFolder()
      }
      if (this.existsInThisFolder(parent_folder, name)) {
        return this.nameExistsError()
      }
      // We'll wait for the socket.io notification to actually
      // add the file for us.
      return this.ide.$http.post(
        `/project/${this.ide.project_id}/linked_file`,
        {
          name,
          parent_folder_id:
            parent_folder != null ? parent_folder.id : undefined,
          provider,
          data,
          _csrf: window.csrfToken
        },
        {
          disableAutoLoginRedirect: true
        }
      )
    }

    refreshLinkedFile(file) {
      const parent_folder = this._findParentFolder(file)
      const provider =
        file.linkedFileData != null ? file.linkedFileData.provider : undefined
      if (provider == null) {
        console.warn(`>> no provider for ${file.name}`, file)
        return
      }
      return this.ide.$http.post(
        `/project/${this.ide.project_id}/linked_file/${file.id}/refresh`,
        {
          _csrf: window.csrfToken
        },
        {
          disableAutoLoginRedirect: true
        }
      )
    }

    renameEntity(entity, name, callback) {
      if (callback == null) {
        callback = function(error) {}
      }
      if (entity.name === name) {
        return
      }
      if (name.length >= 150) {
        return
      }
      // check if a doc/file/folder already exists with this name
      const parent_folder = this.getCurrentFolder()
      if (this.existsInThisFolder(parent_folder, name)) {
        return this.nameExistsError()
      }
      entity.renamingToName = name
      return this.ide.$http
        .post(
          `/project/${this.ide.project_id}/${entity.type}/${entity.id}/rename`,
          {
            name,
            _csrf: window.csrfToken
          }
        )
        .then(() => (entity.name = name))
        .finally(() => (entity.renamingToName = null))
    }

    deleteEntity(entity, callback) {
      // We'll wait for the socket.io notification to
      // delete from scope.
      if (callback == null) {
        callback = function(error) {}
      }
      return this.ide.queuedHttp({
        method: 'DELETE',
        url: `/project/${this.ide.project_id}/${entity.type}/${entity.id}`,
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      })
    }

    moveEntity(entity, parent_folder, callback) {
      // Abort move if the folder being moved (entity) has the parent_folder as child
      // since that would break the tree structure.
      if (callback == null) {
        callback = function(error) {}
      }
      if (this._isChildFolder(entity, parent_folder)) {
        return
      }
      // check if a doc/file/folder already exists with this name
      if (this.existsInThisFolder(parent_folder, entity.name)) {
        return this.nameExistsError()
      }
      // Wait for the http response before doing the move
      return this.ide.queuedHttp
        .post(
          `/project/${this.ide.project_id}/${entity.type}/${entity.id}/move`,
          {
            folder_id: parent_folder.id,
            _csrf: window.csrfToken
          }
        )
        .then(() => {
          return this._moveEntityInScope(entity, parent_folder)
        })
    }

    _isChildFolder(parent_folder, child_folder) {
      const parent_path = this.getEntityPath(parent_folder) || '' // null if root folder
      const child_path = this.getEntityPath(child_folder) || '' // null if root folder
      // is parent path the beginning of child path?
      return child_path.slice(0, parent_path.length) === parent_path
    }

    _deleteEntityFromScope(entity, options) {
      if (options == null) {
        options = { moveToDeleted: true }
      }
      if (entity == null) {
        return
      }
      let parent_folder = null
      this.forEachEntity(function(possible_entity, folder) {
        if (possible_entity === entity) {
          return (parent_folder = folder)
        }
      })

      if (parent_folder != null) {
        const index = parent_folder.children.indexOf(entity)
        if (index > -1) {
          parent_folder.children.splice(index, 1)
        }
      }

      if (entity.type === 'doc' && options.moveToDeleted) {
        entity.deleted = true
        return this.$scope.deletedDocs.push(entity)
      }
    }

    _moveEntityInScope(entity, parent_folder) {
      if (Array.from(parent_folder.children).includes(entity)) {
        return
      }
      this._deleteEntityFromScope(entity, { moveToDeleted: false })
      return parent_folder.children.push(entity)
    }
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
