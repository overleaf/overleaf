import { useTranslation } from 'react-i18next'
import MaterialIcon from '../../../shared/components/material-icon'
import { getTagColor } from '../util/tag'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../context/project-list-context'
import useTag from '../hooks/use-tag'
import { sortBy } from 'lodash'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'

type TagsListProps = {
  onTagClick?: () => void
  onEditClick?: () => void
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
    onTagClick?.()
  }

  return (
    <>
      <>
        {sortBy(tags, ['name']).map((tag, index) => (
          <li role="none" className="position-relative" key={index}>
            <DropdownItem
              as="button"
              tabIndex={-1}
              onClick={e => handleClick(e as unknown as React.MouseEvent, tag)}
              leadingIcon={
                <span style={{ color: getTagColor(tag) }}>
                  <MaterialIcon type="label" className="align-text-top" />
                </span>
              }
              trailingIcon={selectedTagId === tag._id ? 'check' : undefined}
              active={selectedTagId === tag._id}
            >
              <span className="project-menu-item-tag-name text-truncate">
                {tag.name}&nbsp;({tag.project_ids?.length})
              </span>
            </DropdownItem>
            <DropdownItem
              as="button"
              tabIndex={-1}
              className="project-menu-item-edit-btn"
              onClick={e => {
                e.stopPropagation()
                handleManageTag(e, tag._id)
              }}
              aria-label={t('edit_tag')}
            >
              <MaterialIcon type="edit" className="align-text-top" />
            </DropdownItem>
          </li>
        ))}
        <li role="none">
          <DropdownItem
            as="button"
            tabIndex={-1}
            onClick={() => selectTag(UNCATEGORIZED_KEY)}
            trailingIcon={
              selectedTagId === UNCATEGORIZED_KEY ? 'check' : undefined
            }
            active={selectedTagId === UNCATEGORIZED_KEY}
          >
            {t('uncategorized')}&nbsp;({untaggedProjectsCount})
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            tabIndex={-1}
            onClick={openCreateTagModal}
            leadingIcon="add"
          >
            {t('new_tag')}
          </DropdownItem>
        </li>
      </>
      <CreateTagModal id="create-tag-modal-dropdown" disableCustomColor />
      <ManageTagModal id="manage-tag-modal-dropdown" />
    </>
  )
}

export default TagsList
