const FILE_PER_FOLDER = 2
const DOC_PER_FOLDER = 3
const FOLDER_PER_FOLDER = 2
const MAX_DEPTH = 7

function fakeId() {
  return Math.random().toString(16).replace(/0\./, 'random-test-id-')
}

function makeFileRefs(path) {
  const fileRefs = []

  for (let index = 0; index < FILE_PER_FOLDER; index++) {
    fileRefs.push({ _id: fakeId(), name: `${path}-file-${index}.jpg` })
  }
  return fileRefs
}

function makeDocs(path) {
  const docs = []

  for (let index = 0; index < DOC_PER_FOLDER; index++) {
    docs.push({ _id: fakeId(), name: `${path}-doc-${index}.tex` })
  }
  return docs
}

function makeFolders(path, depth = 0) {
  const folders = []

  for (let index = 0; index < FOLDER_PER_FOLDER; index++) {
    const folderPath = `${path}-folder-${index}`
    folders.push({
      _id: fakeId(),
      name: folderPath,
      folders: depth < MAX_DEPTH ? makeFolders(folderPath, depth + 1) : [],
      fileRefs: makeFileRefs(folderPath),
      docs: makeDocs(folderPath),
    })
  }
  return folders
}

export const rootFolderLimit = [
  {
    _id: fakeId(),
    name: 'rootFolder',
    folders: makeFolders('root'),
    fileRefs: makeFileRefs('root'),
    docs: makeDocs('root'),
  },
]
