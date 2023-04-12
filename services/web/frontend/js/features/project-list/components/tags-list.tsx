import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '../../../shared/components/material-icon'
import { getTagColor } from '../util/tag'
import MenuItemButton from './dropdown/menu-item-button'
import Icon from '../../../shared/components/icon'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../context/project-list-context'
import useTag from '../hooks/use-tag'
import { sortBy } from 'lodash'
import { Tag } from '../../../../../app/src/Features/Tags/types'

type TagsListProps = {
  onTagClick: () => void
  onEditClick: () => void
}

function TagsList({ onTagClick, onEditClick }: TagsListProps) {
  const { t } = useTranslation()
  const { tags, untaggedProjectsCount, selectedTagId, selectTag } =
    useProjectListContext()

  const {
    handleSelectTag,
    openCreateTagModal,
    handleManageTag,
    CreateTagModal,
    ManageTagModal,
  } = useTag()

  const handleClick = (e: React.MouseEvent, tag: Tag) => {
    handleSelectTag(e, tag._id)
    onTagClick()
  }

  return (
    <>
      {sortBy(tags, ['name']).map((tag, index) => (
        <MenuItemButton
          key={index}
          onClick={e => handleClick(e as unknown as React.MouseEvent, tag)}
          className="projects-types-menu-item projects-types-menu-tag-item"
          afterNode={
            <Button
              onClick={e => {
                e.stopPropagation()
                handleManageTag(e, tag._id)
                onEditClick()
              }}
              className="btn-transparent edit-btn me-2"
              bsStyle={null}
            >
              <Icon type="pencil" fw />
            </Button>
          }
        >
          <span className="tag-item menu-item-button-text">
            {selectedTagId === tag._id ? (
              <Icon type="check" className="menu-item-button-icon" />
            ) : null}
            <span
              className="me-2"
              style={{
                color: getTagColor(tag),
              }}
            >
              <MaterialIcon type="label" style={{ verticalAlign: 'sub' }} />
            </span>
            <span>
              {tag.name}{' '}
              <span className="subdued"> ({tag.project_ids?.length})</span>
            </span>
          </span>
        </MenuItemButton>
      ))}
      <MenuItemButton
        className="untagged projects-types-menu-item"
        onClick={() => {
          selectTag(UNCATEGORIZED_KEY)
          onTagClick()
        }}
      >
        {selectedTagId === UNCATEGORIZED_KEY ? (
          <Icon type="check" className="menu-item-button-icon" />
        ) : null}
        <span className="tag-item menu-item-button-text">
          {t('uncategorized')}&nbsp;
          <span className="subdued">({untaggedProjectsCount})</span>
        </span>
      </MenuItemButton>
      <MenuItemButton
        onClick={() => {
          openCreateTagModal()
          onTagClick()
        }}
        className="projects-types-menu-item"
      >
        <span className="tag-item menu-item-button-text">
          <Icon type="plus" className="me-2" />
          <span>{t('new_tag')}</span>
        </span>
      </MenuItemButton>
      <CreateTagModal id="create-tag-modal-dropdown" disableCustomColor />
      <ManageTagModal id="manage-tag-modal-dropdown" />
    </>
  )
}

export default TagsList
