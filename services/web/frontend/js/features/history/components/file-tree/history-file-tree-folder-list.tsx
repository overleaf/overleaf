import classNames from 'classnames'

import HistoryFileTreeDoc from './history-file-tree-doc'
import HistoryFileTreeFolder from './history-file-tree-folder'
import { fileCollator } from '../../../file-tree/util/file-collator'
import type { Doc } from '../../../../../../types/doc'
import type { ReactNode } from 'react'
import type { HistoryFileTree } from '../../utils/file-tree'

type HistoryFileTreeFolderListProps = {
  folders: HistoryFileTree[]
  docs: Doc[]
  rootClassName?: string
  children?: ReactNode
}

export default function HistoryFileTreeFolderList({
  folders,
  docs,
  rootClassName,
  children,
}: HistoryFileTreeFolderListProps) {
  return (
    <ul className={classNames('list-unstyled', rootClassName)} role="tree">
      {folders.sort(compareFunction).map(folder => {
        return (
          <HistoryFileTreeFolder
            key={folder._id}
            name={folder.name}
            folders={folder.folders}
            docs={folder.docs ?? []}
          />
        )
      })}
      {docs.sort(compareFunction).map(doc => {
        return <HistoryFileTreeDoc key={doc._id} name={doc.name} id={doc._id} />
      })}
      {children}
    </ul>
  )
}

function compareFunction(
  one: HistoryFileTree | Doc,
  two: HistoryFileTree | Doc
) {
  return fileCollator.compare(one.name, two.name)
}
