import classNames from 'classnames'

import FileTreeDoc from './file-tree-doc'
import FileTreeFolder from './file-tree-folder'
import { fileCollator } from '../util/file-collator'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'
import { ConnectDropTarget } from 'react-dnd'

type ExtendedFileRef = FileRef & { isFile: true }

function FileTreeFolderList({
  folders,
  docs,
  files,
  classes = {},
  dropRef = null,
  children,
  dataTestId,
}: {
  folders: Folder[]
  docs: Doc[]
  files: FileRef[]
  classes?: { root?: string }
  dropRef?: ConnectDropTarget | null
  children?: React.ReactNode
  dataTestId?: string
}) {
  files = files.map(file => ({ ...file, isFile: true }))
  const docsAndFiles: (Doc | ExtendedFileRef)[] = [...docs, ...files]

  return (
    <ul
      className={classNames(
        'list-unstyled',
        'file-tree-folder-list',
        classes.root
      )}
      role="tree"
      ref={dropRef}
      data-testid={dataTestId}
    >
      <div className="file-tree-folder-list-inner">
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
          if ('isFile' in doc) {
            return (
              <FileTreeDoc
                key={doc._id}
                name={doc.name}
                id={doc._id}
                isFile={doc.isFile}
                isLinkedFile={
                  doc.linkedFileData && !!doc.linkedFileData.provider
                }
              />
            )
          }

          return <FileTreeDoc key={doc._id} name={doc.name} id={doc._id} />
        })}
        {children}
      </div>
    </ul>
  )
}

function compareFunction(one: { name: string }, two: { name: string }) {
  return fileCollator.compare(one.name, two.name)
}

export default FileTreeFolderList
