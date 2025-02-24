import { sortBy } from 'lodash'
import { useTranslation } from 'react-i18next'
import { DotsThreeVertical, Plus, TagSimple } from '@phosphor-icons/react'
import MaterialIcon from '../../../../shared/components/material-icon'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import useTag from '../../hooks/use-tag'
import { getTagColor } from '../../util/tag'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { hasDsNav } from '@/features/project-list/components/use-is-ds-nav'

export default function TagsList() {
  const { t } = useTranslation()
  const {
    tags,
    projectsPerTag,
    untaggedProjectsCount,
    selectedTagId,
    selectTag,
  } = useProjectListContext()
  const {
    handleSelectTag,
    openCreateTagModal,
    handleEditTag,
    handleDeleteTag,
    CreateTagModal,
    EditTagModal,
    DeleteTagModal,
  } = useTag()

  return (
    <>
      <li
        className="dropdown-header"
        aria-hidden="true"
        data-testid="organize-projects"
      >
        {hasDsNav() ? t('organize_tags') : t('organize_projects')}
      </li>
      <li className="tag">
        <button type="button" className="tag-name" onClick={openCreateTagModal}>
          {hasDsNav() ? (
            <Plus weight="bold" />
          ) : (
            <MaterialIcon type="add" className="tag-list-icon" />
          )}

          <span className="name">{t('new_tag')}</span>
        </button>
      </li>
      {sortBy(tags, tag => tag.name?.toLowerCase()).map(tag => {
        return (
          <li
            className={`tag ${selectedTagId === tag._id ? 'active' : ''}`}
            key={tag._id}
          >
            <button
              type="button"
              className="tag-name"
              onClick={e =>
                handleSelectTag(e as unknown as React.MouseEvent, tag._id)
              }
            >
              <span
                style={{
                  color: getTagColor(tag),
                }}
              >
                {hasDsNav() ? (
                  <TagSimple weight="fill" className="tag-list-icon" />
                ) : (
                  <MaterialIcon type="label" className="tag-list-icon" />
                )}
              </span>
              <span className="name">
                {tag.name}{' '}
                <span className="subdued">
                  ({projectsPerTag[tag._id].length})
                </span>
              </span>
            </button>

            <Dropdown align="end" className="tag-menu">
              <DropdownToggle
                aria-label={t('open_action_menu', { name: tag.name })}
                id={`${tag._id}-dropdown-toggle`}
                data-testid="tag-dropdown-toggle"
              >
                {hasDsNav() && <DotsThreeVertical weight="bold" />}
              </DropdownToggle>
              <DropdownMenu className="dropdown-menu-sm-width">
                <DropdownItem
                  as="li"
                  className="tag-action"
                  onClick={e => handleEditTag(e, tag._id)}
                >
                  {t('edit')}
                </DropdownItem>
                <DropdownItem
                  as="li"
                  className="tag-action"
                  onClick={e => handleDeleteTag(e, tag._id)}
                >
                  {t('delete')}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </li>
        )
      })}
      {tags.length > 0 && (
        <li
          className={`tag untagged ${
            selectedTagId === UNCATEGORIZED_KEY ? 'active' : ''
          }`}
        >
          <button
            type="button"
            className="tag-name"
            onClick={() => selectTag(UNCATEGORIZED_KEY)}
          >
            <span className="name fst-italic">
              {t('uncategorized')}{' '}
              <span className="subdued">({untaggedProjectsCount})</span>
            </span>
          </button>
        </li>
      )}
      <CreateTagModal id="create-tag-modal" />
      <EditTagModal id="edit-tag-modal" />
      <DeleteTagModal id="delete-tag-modal" />
    </>
  )
}
