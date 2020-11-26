import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'

import FileTreeDoc from './file-tree-doc'
import FileTreeFolder from './file-tree-folder'

function FileTreeFolderList({
  folders,
  docs,
  files,
  classes = {},
  dropRef = null
}) {
  const docsAndFiles = [...docs, ...files].sort(
    (one, two) => one.name.toLowerCase() > two.name.toLowerCase()
  )

  return (
    <ul
      className={classNames('list-unstyled', classes.root)}
      role="tree"
      ref={dropRef}
    >
      {folders.map(folder => {
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
      {docsAndFiles.map(doc => {
        return (
          <FileTreeDoc
            key={doc._id}
            name={doc.name}
            id={doc._id}
            isLinkedFile={doc.linkedFileData && !!doc.linkedFileData.provider}
          />
        )
      })}
    </ul>
  )
}

FileTreeFolderList.propTypes = {
  folders: PropTypes.array.isRequired,
  docs: PropTypes.array.isRequired,
  files: PropTypes.array.isRequired,
  classes: PropTypes.exact({
    root: PropTypes.string
  }),
  dropRef: PropTypes.func
}

export default FileTreeFolderList
