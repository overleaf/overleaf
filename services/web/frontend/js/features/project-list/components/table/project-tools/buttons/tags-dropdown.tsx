import { sortBy } from 'lodash'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '../../../../../../shared/components/material-icon'
import { useProjectListContext } from '../../../../context/project-list-context'
import useTag from '../../../../hooks/use-tag'
import { addProjectsToTag, removeProjectsFromTag } from '../../../../util/api'
import { getTagColor } from '../../../../util/tag'
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import { Tag } from '../../../../../../../../app/src/Features/Tags/types'

function TagsDropdown() {
  const {
    tags,
    selectedProjects,
    addProjectToTagInView,
    removeProjectFromTagInView,
  } = useProjectListContext()
  const { t } = useTranslation()
  const { openCreateTagModal, CreateTagModal } = useTag()

  const handleOpenCreateTagModal = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      openCreateTagModal()
    },
    [openCreateTagModal]
  )

  const handleAddTagToSelectedProjects = useCallback(
    (e: React.MouseEvent, tagId: string) => {
      e.preventDefault()
      const tag = tags.find(tag => tag._id === tagId)
      const projectIds = []
      for (const selectedProject of selectedProjects) {
        if (!tag?.project_ids?.includes(selectedProject.id)) {
          addProjectToTagInView(tagId, selectedProject.id)
          projectIds.push(selectedProject.id)
        }
      }
      addProjectsToTag(tagId, projectIds)
    },
    [tags, selectedProjects, addProjectToTagInView]
  )

  const handleRemoveTagFromSelectedProjects = useCallback(
    (e: React.MouseEvent, tagId: string) => {
      e.preventDefault()
      for (const selectedProject of selectedProjects) {
        removeProjectFromTagInView(tagId, selectedProject.id)
      }
      removeProjectsFromTag(
        tagId,
        selectedProjects.map(project => project.id)
      )
    },
    [selectedProjects, removeProjectFromTagInView]
  )

  const containsAllSelectedProjects = useCallback(
    (tag: Tag) => {
      for (const project of selectedProjects) {
        if (!(tag.project_ids || []).includes(project.id)) {
          return false
        }
      }
      return true
    },
    [selectedProjects]
  )

  return (
    <>
      <Dropdown align="end" autoClose="outside">
        <DropdownToggle
          id="project-tools-more-dropdown"
          variant="secondary"
          aria-label={t('tags')}
        >
          <MaterialIcon type="label" className="align-text-top" />
        </DropdownToggle>
        <DropdownMenu
          flip={false}
          data-testid="project-tools-more-dropdown-menu"
        >
          <DropdownHeader>{t('add_to_tag')}</DropdownHeader>
          {sortBy(tags, tag => tag.name?.toLowerCase()).map(tag => (
            <li role="none" key={tag._id}>
              <DropdownItem
                onClick={e =>
                  containsAllSelectedProjects(tag)
                    ? handleRemoveTagFromSelectedProjects(e, tag._id)
                    : handleAddTagToSelectedProjects(e, tag._id)
                }
                aria-label={t('add_or_remove_project_from_tag', {
                  tagName: tag.name,
                })}
                as="button"
                tabIndex={-1}
                leadingIcon={
                  containsAllSelectedProjects(tag) ? (
                    'check'
                  ) : (
                    <DropdownItem.EmptyLeadingIcon />
                  )
                }
                translate="no"
              >
                <div className="badge-tag-content">
                  <span className="badge-prepend">
                    <i
                      className="badge-tag-circle align-self-center ms-0"
                      style={{ backgroundColor: getTagColor(tag) }}
                    />
                  </span>
                  <span className="text-truncate">{tag.name}</span>
                </div>
              </DropdownItem>
            </li>
          ))}
          <DropdownDivider />
          <li role="none">
            <DropdownItem
              onClick={handleOpenCreateTagModal}
              as="button"
              tabIndex={-1}
            >
              {t('create_new_tag')}
            </DropdownItem>
          </li>
        </DropdownMenu>
      </Dropdown>
      <CreateTagModal id="toolbar-create-tag-modal" />
    </>
  )
}

export default memo(TagsDropdown)
