// Project structure tracking — maintains the bidirectional maps the syncer
// needs to translate between filesystem paths and Overleaf doc/file/folder
// ObjectIds.
//
// Pulled out of syncer.js so the structural-event logic can be tested in
// isolation.

const path = require('node:path')

class StructureIndex {
  constructor() {
    // pathname (relative, no leading slash) -> { type, id }
    this.byPath = new Map()
    // id -> pathname
    this.byId = new Map()
    this.rootFolderId = null
  }

  setRoot(folderId) {
    this.rootFolderId = String(folderId)
    // Root folder occupies the empty path.
    this.byPath.set('', { type: 'folder', id: this.rootFolderId })
    this.byId.set(this.rootFolderId, '')
  }

  add(pathname, type, id) {
    const idStr = String(id)
    this.byPath.set(pathname, { type, id: idStr })
    this.byId.set(idStr, pathname)
  }

  removeByPath(pathname) {
    const entry = this.byPath.get(pathname)
    if (!entry) return null
    this.byPath.delete(pathname)
    this.byId.delete(entry.id)
    // If this is a folder, drop everything under it.
    if (entry.type === 'folder') {
      const prefix = pathname + '/'
      for (const p of Array.from(this.byPath.keys())) {
        if (p.startsWith(prefix)) {
          const child = this.byPath.get(p)
          this.byPath.delete(p)
          if (child) this.byId.delete(child.id)
        }
      }
    }
    return entry
  }

  removeById(id) {
    const idStr = String(id)
    const p = this.byId.get(idStr)
    if (p == null) return null
    return this.removeByPath(p)
  }

  lookupPath(pathname) {
    return this.byPath.get(pathname) || null
  }

  lookupId(id) {
    const p = this.byId.get(String(id))
    return p == null ? null : { pathname: p, entry: this.byPath.get(p) }
  }

  parentFolderIdOf(pathname) {
    const parentPath = path.posix.dirname(pathname)
    const parent = this.byPath.get(parentPath === '.' ? '' : parentPath)
    if (parent && parent.type === 'folder') return parent.id
    return null
  }

  // Walks a project rootFolder tree (as returned by joinProject /
  // getProjectStructure) into this index. Replaces any existing state.
  loadFromRootFolder(rootFolder) {
    this.byPath.clear()
    this.byId.clear()
    this.rootFolderId = null
    if (!Array.isArray(rootFolder) || rootFolder.length === 0) return
    const root = rootFolder[0]
    if (root && root._id) {
      this.setRoot(root._id)
    }
    walkFolder(root, '', this)
  }
}

function walkFolder(folder, prefix, index) {
  if (!folder) return
  for (const doc of folder.docs || []) {
    if (!doc?._id || !doc?.name) continue
    const p = prefix ? `${prefix}/${doc.name}` : doc.name
    index.add(p, 'doc', doc._id)
  }
  for (const file of folder.fileRefs || []) {
    if (!file?._id || !file?.name) continue
    const p = prefix ? `${prefix}/${file.name}` : file.name
    index.add(p, 'file', file._id)
  }
  for (const sub of folder.folders || []) {
    if (!sub?._id || !sub?.name) continue
    const p = prefix ? `${prefix}/${sub.name}` : sub.name
    index.add(p, 'folder', sub._id)
    walkFolder(sub, p, index)
  }
}

module.exports = { StructureIndex }
