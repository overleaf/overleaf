import classNames from 'classnames'

import HistoryFileTreeDoc from './history-file-tree-doc'
import HistoryFileTreeFolder from './history-file-tree-folder'
import { fileCollator } from '../../../file-tree/util/file-collator'
import type { ReactNode } from 'react'
import type { HistoryFileTree, HistoryDoc } from '../../utils/file-tree'

type HistoryFileTreeFolderListProps = {
  folders: HistoryFileTree[]
  docs: HistoryDoc[]
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
            key={folder.name}
            name={folder.name}
            folders={folder.folders}
            docs={folder.docs ?? []}
          />
        )
      })}
      {docs.sort(compareFunction).map(doc => {
        return (
          <HistoryFileTreeDoc
            key={doc.pathname}
            name={doc.name}
            pathname={doc.pathname}
            operation={doc.operation}
          />
        )
      })}
      {children}
    </ul>
  )
}

function compareFunction(
  one: HistoryFileTree | HistoryDoc,
  two: HistoryFileTree | HistoryDoc
) {
  return fileCollator.compare(one.name, two.name)
}
