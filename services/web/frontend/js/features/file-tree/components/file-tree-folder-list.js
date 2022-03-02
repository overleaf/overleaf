import PropTypes from 'prop-types'
import classNames from 'classnames'

import FileTreeDoc from './file-tree-doc'
import FileTreeFolder from './file-tree-folder'
import { fileCollator } from '../util/file-collator'

function FileTreeFolderList({
  folders,
  docs,
  files,
  classes = {},
  dropRef = null,
  children,
}) {
  files = files.map(file => ({ ...file, isFile: true }))
  const docsAndFiles = [...docs, ...files]

  return (
    <ul
      className={classNames('list-unstyled', classes.root)}
      role="tree"
      ref={dropRef}
      dnd-container="true"
    >
      {folders.sort(compareFunction).map(folder => {
        return (
          <FileTreeFolder
            key={folder._id}
            name={folder.name}
            id={folder._id}
            folders={folder.folders}
            docs={folder.docs}
            files={folder.fileRefs}
          />
        )
      })}
      {docsAndFiles.sort(compareFunction).map(doc => {
        return (
          <FileTreeDoc
            key={doc._id}
            name={doc.name}
            id={doc._id}
            isFile={doc.isFile}
            isLinkedFile={doc.linkedFileData && !!doc.linkedFileData.provider}
          />
        )
      })}
      {children}
    </ul>
  )
}

FileTreeFolderList.propTypes = {
  folders: PropTypes.array.isRequired,
  docs: PropTypes.array.isRequired,
  files: PropTypes.array.isRequired,
  classes: PropTypes.exact({
    root: PropTypes.string,
  }),
  dropRef: PropTypes.func,
  children: PropTypes.node,
}

function compareFunction(one, two) {
  return fileCollator.compare(one.name, two.name)
}

export default FileTreeFolderList
