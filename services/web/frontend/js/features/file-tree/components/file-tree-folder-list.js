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
  dropRef = null,
  children
}) {
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
    root: PropTypes.string
  }),
  dropRef: PropTypes.func,
  children: PropTypes.node
}

// the collator used to sort files docs and folders in the tree. Use english as
// base language for consistency. Options used:
// numeric: true so 10 comes after 2
// sensitivity: 'variant' so case and accent are not equal
// caseFirst: 'upper' so upper-case letters come first
const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'variant',
  caseFirst: 'upper'
})

function compareFunction(one, two) {
  return collator.compare(one.name, two.name)
}

export default FileTreeFolderList
