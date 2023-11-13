import { Folder } from '../../../../../types/folder'
import { DocId, MainDocument } from '../../../../../types/project-settings'

function findAllDocsInFolder(folder: Folder, path = '') {
  const docs = folder.docs.map<MainDocument>(doc => ({
    doc: { id: doc._id as DocId, name: doc.name },
    path: path + doc.name,
  }))
  for (const subFolder of folder.folders) {
    docs.push(...findAllDocsInFolder(subFolder, `${path}${subFolder.name}/`))
  }
  return docs
}

export function docsInFolder(folder: Folder) {
  const docsInTree = findAllDocsInFolder(folder)
  docsInTree.sort(function (a, b) {
    const aDepth = (a.path.match(/\//g) || []).length
    const bDepth = (b.path.match(/\//g) || []).length
    if (aDepth - bDepth !== 0) {
      return -(aDepth - bDepth) // Deeper path == folder first
    } else if (a.path < b.path) {
      return -1
    } else if (a.path > b.path) {
      return 1
    } else {
      return 0
    }
  })
  return docsInTree
}
