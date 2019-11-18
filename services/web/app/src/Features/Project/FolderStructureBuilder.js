const Path = require('path')
const OError = require('@overleaf/o-error')
const { ObjectId } = require('mongodb')

module.exports = { buildFolderStructure }

function buildFolderStructure(docUploads, fileUploads) {
  const builder = new FolderStructureBuilder()
  for (const docUpload of docUploads) {
    builder.addDocUpload(docUpload)
  }
  for (const fileUpload of fileUploads) {
    builder.addFileUpload(fileUpload)
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

  addDocUpload(docUpload) {
    this.recordEntityPath(Path.join(docUpload.dirname, docUpload.doc.name))
    const folder = this.mkdirp(docUpload.dirname)
    folder.docs.push(docUpload.doc)
  }

  addFileUpload(fileUpload) {
    this.recordEntityPath(
      Path.join(fileUpload.dirname, fileUpload.fileRef.name)
    )
    const folder = this.mkdirp(fileUpload.dirname)
    folder.fileRefs.push(fileUpload.fileRef)
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
      throw new OError({ message: 'entity already exists', info: { path } })
    }
    this.entityPaths.add(path)
  }

  createFolder(name) {
    return {
      _id: ObjectId(),
      name,
      folders: [],
      docs: [],
      fileRefs: []
    }
  }
}
