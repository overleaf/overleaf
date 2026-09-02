import { sortBy } from 'lodash'
import { useTranslation } from 'react-i18next'
import { DotsThreeVertical, Plus, TagSimple } from '@phosphor-icons/react'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import useTag from '../../hooks/use-tag'
import { getTagColor } from '../../util/tag'
import {
  OLDropdown,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function TagsList() {
  const { t } = useTranslation()
  const isSharedWorkspaceEnabled = useFeatureFlag('shared-workspace')
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
        {isSharedWorkspaceEnabled ? t('your_tags') : t('organize_tags')}
      </li>
      <li className="tag">
        <button type="button" className="tag-name" onClick={openCreateTagModal}>
          <Plus weight="bold" />
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
              translate="no"
              onClick={e =>
                handleSelectTag(e as unknown as React.MouseEvent, tag._id)
              }
            >
              <span
                style={{
                  color: getTagColor(tag),
                }}
              >
                <TagSimple weight="fill" className="tag-list-icon" />
              </span>
              <span className="name">
                {tag.name}{' '}
                <span className="subdued">
                  ({projectsPerTag[tag._id].length})
                </span>
              </span>
            </button>

            <OLDropdown align="end" className="tag-menu">
              <OLDropdownToggle
                aria-label={t('open_action_menu', { name: tag.name })}
                id={`${tag._id}-dropdown-toggle`}
                data-testid="tag-dropdown-toggle"
              >
                <DotsThreeVertical weight="bold" />
              </OLDropdownToggle>
              <OLDropdownMenu className="dropdown-menu-sm-width">
                <OLDropdownItem
                  as="li"
                  className="tag-action"
                  onClick={e => handleEditTag(e, tag._id)}
                >
                  {t('edit')}
                </OLDropdownItem>
                <OLDropdownItem
                  as="li"
                  className="tag-action"
                  onClick={e => handleDeleteTag(e, tag._id)}
                >
                  {t('delete')}
                </OLDropdownItem>
              </OLDropdownMenu>
            </OLDropdown>
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
