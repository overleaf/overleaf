import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

import Icon from '../../../shared/components/icon'
import {
  useFileTreeSelectable,
  useSelectableEntity,
} from '../contexts/file-tree-selectable'
import { useDroppable } from '../contexts/file-tree-draggable'

import FileTreeItemInner from './file-tree-item/file-tree-item-inner'
import FileTreeFolderList from './file-tree-folder-list'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

function FileTreeFolder({ name, id, folders, docs, files }) {
  const { t } = useTranslation()

  const { isSelected, props: selectableEntityProps } = useSelectableEntity(
    id,
    'folder'
  )

  const { selectedEntityParentIds } = useFileTreeSelectable(id)

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

  const icons = (
    <BootstrapVersionSwitcher
      bs3={
        <>
          <button
            onClick={handleExpandCollapseClick}
            aria-label={expanded ? t('collapse') : t('expand')}
          >
            <Icon
              type={expanded ? 'angle-down' : 'angle-right'}
              fw
              className="file-tree-expand-icon"
            />
          </button>
          <Icon
            type={expanded ? 'folder-open' : 'folder'}
            fw
            className="file-tree-folder-icon"
          />
        </>
      }
      bs5={
        <>
          <button
            onClick={handleExpandCollapseClick}
            aria-label={expanded ? t('collapse') : t('expand')}
          >
            <MaterialIcon
              type={expanded ? 'expand_more' : 'chevron_right'}
              className="file-tree-expand-icon"
            />
          </button>
          <MaterialIcon
            type={expanded ? 'folder_open' : 'folder'}
            className="file-tree-folder-icon"
          />
        </>
      }
    />
  )

  return (
    <>
      <li
        // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
        role="treeitem"
        // aria-selected is provided in selectableEntityProps
        {...selectableEntityProps}
        aria-expanded={expanded}
        aria-label={name}
        tabIndex="0"
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
          icons={icons}
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

FileTreeFolder.propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  folders: PropTypes.array.isRequired,
  docs: PropTypes.array.isRequired,
  files: PropTypes.array.isRequired,
}

export default FileTreeFolder
