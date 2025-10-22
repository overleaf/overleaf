const Path = require('path')
const OError = require('@overleaf/o-error')
const { ObjectId } = require('mongodb-legacy')

module.exports = { buildFolderStructure }

function buildFolderStructure(docEntries, fileEntries) {
  const builder = new FolderStructureBuilder()
  for (const docEntry of docEntries) {
    builder.addDocEntry(docEntry)
  }
  for (const fileEntry of fileEntries) {
    builder.addFileEntry(fileEntry)
  }
  return builder.rootFolder
}

class FolderStructureBuilder {
  constructor() {
    this.foldersByPath = new Map()
    this.entityPaths = new Set()
    this.rootFolder = this.createFolder('rootFolder')
    this.foldersByPath.set('/', this.rootFolder)
    this.entityPaths.add('/')
  }

  addDocEntry(docEntry) {
    this.recordEntityPath(docEntry.path)
    const folderPath = Path.dirname(docEntry.path)
    const folder = this.mkdirp(folderPath)
    folder.docs.push(docEntry.doc)
  }

  addFileEntry(fileEntry) {
    this.recordEntityPath(fileEntry.path)
    const folderPath = Path.dirname(fileEntry.path)
    const folder = this.mkdirp(folderPath)
    folder.fileRefs.push(fileEntry.file)
  }

  mkdirp(path) {
    const existingFolder = this.foldersByPath.get(path)
    if (existingFolder != null) {
      return existingFolder
    }
    // Folder not found, create it.
    this.recordEntityPath(path)
    const dirname = Path.dirname(path)
    const basename = Path.basename(path)
    const parentFolder = this.mkdirp(dirname)
    const newFolder = this.createFolder(basename)
    parentFolder.folders.push(newFolder)
    this.foldersByPath.set(path, newFolder)
    return newFolder
  }

  recordEntityPath(path) {
    if (this.entityPaths.has(path)) {
      throw new OError('entity already exists', { path })
    }
    this.entityPaths.add(path)
  }

  createFolder(name) {
    return {
      _id: new ObjectId(),
      name,
      folders: [],
      docs: [],
      fileRefs: [],
    }
  }
}
