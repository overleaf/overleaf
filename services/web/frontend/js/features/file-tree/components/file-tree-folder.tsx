import { useEffect } from 'react'
import classNames from 'classnames'

import {
  useFileTreeSelectable,
  useSelectableEntity,
} from '../contexts/file-tree-selectable'
import { useDroppable } from '../contexts/file-tree-draggable'

import FileTreeItemInner from './file-tree-item/file-tree-item-inner'
import FileTreeFolderList from './file-tree-folder-list'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'
import FileTreeFolderIcons from './file-tree-folder-icons'

function FileTreeFolder({
  name,
  id,
  folders,
  docs,
  files,
}: {
  name: string
  id: string
  folders: Folder[]
  docs: Doc[]
  files: FileRef[]
}) {
  const { isSelected, props: selectableEntityProps } = useSelectableEntity(
    id,
    'folder'
  )

  const { selectedEntityParentIds } = useFileTreeSelectable()

  const [expanded, setExpanded] = usePersistedState(
    `folder.${id}.expanded`,
    false
  )

  useEffect(() => {
    if (selectedEntityParentIds.has(id)) {
      setExpanded(true)
    }
  }, [id, selectedEntityParentIds, setExpanded])

  function handleExpandCollapseClick() {
    setExpanded(!expanded)
  }

  const { isOver: isOverRoot, dropRef: dropRefRoot } = useDroppable(id)
  const { isOver: isOverList, dropRef: dropRefList } = useDroppable(id)

  return (
    <>
      <li
        // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
        role="treeitem"
        // aria-selected is provided in selectableEntityProps
        {...selectableEntityProps}
        aria-expanded={expanded}
        aria-label={name}
        tabIndex={0}
        ref={dropRefRoot}
        className={classNames(selectableEntityProps.className, {
          'dnd-droppable-hover': isOverRoot || isOverList,
        })}
      >
        <FileTreeItemInner
          id={id}
          name={name}
          type="folder"
          isSelected={isSelected}
          icons={
            <FileTreeFolderIcons
              expanded={expanded}
              onExpandCollapseClick={handleExpandCollapseClick}
            />
          }
        />
      </li>
      {expanded ? (
        <FileTreeFolderList
          folders={folders}
          docs={docs}
          files={files}
          dropRef={dropRefList}
        />
      ) : null}
    </>
  )
}

export default FileTreeFolder
