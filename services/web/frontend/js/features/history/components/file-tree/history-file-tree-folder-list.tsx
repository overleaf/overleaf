import classNames from 'classnames'

import HistoryFileTreeDoc from './history-file-tree-doc'
import HistoryFileTreeFolder from './history-file-tree-folder'
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
      {folders.map(folder => (
        <HistoryFileTreeFolder
          key={folder.name}
          name={folder.name}
          folders={folder.folders}
          docs={folder.docs ?? []}
        />
      ))}
      {docs.map(doc => (
        <HistoryFileTreeDoc key={doc.pathname} name={doc.name} file={doc} />
      ))}
      {children}
    </ul>
  )
}
