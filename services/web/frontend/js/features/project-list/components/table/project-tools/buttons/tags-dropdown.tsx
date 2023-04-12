import { sortBy } from 'lodash'
import { memo, useCallback } from 'react'
import { Button, Dropdown } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import ControlledDropdown from '../../../../../../shared/components/controlled-dropdown'
import Icon from '../../../../../../shared/components/icon'
import MaterialIcon from '../../../../../../shared/components/material-icon'
import { useProjectListContext } from '../../../../context/project-list-context'
import useTag from '../../../../hooks/use-tag'
import { addProjectsToTag, removeProjectsFromTag } from '../../../../util/api'
import { getTagColor } from '../../../../util/tag'

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
    e => {
      e.preventDefault()
      openCreateTagModal()
    },
    [openCreateTagModal]
  )

  const handleAddTagToSelectedProjects = useCallback(
    (e, tagId) => {
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
    (e, tagId) => {
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
    tag => {
      for (const project of selectedProjects) {
        if (!(tag.project_ids || []).includes(project.id)) {
          return false
        }
      }
      return true
    },
    [selectedProjects]
  )

  const containsSomeSelectedProjects = useCallback(
    tag => {
      for (const project of selectedProjects) {
        if (tag.project_ids?.includes(project.id)) {
          return true
        }
      }
      return false
    },
    [selectedProjects]
  )

  return (
    <>
      <ControlledDropdown id="tags">
        <Dropdown.Toggle
          bsStyle={null}
          className="btn-secondary"
          title={t('tags')}
          aria-label={t('tags')}
        >
          <MaterialIcon type="label" style={{ verticalAlign: 'sub' }} />
        </Dropdown.Toggle>
        <Dropdown.Menu className="dropdown-menu-right">
          <li className="dropdown-header" role="heading" aria-level={3}>
            {t('add_to_tag')}
          </li>
          {sortBy(tags, tag => tag.name?.toLowerCase()).map(tag => {
            return (
              <li key={tag._id}>
                <Button
                  className="tag-dropdown-button"
                  onClick={e =>
                    containsAllSelectedProjects(tag)
                      ? handleRemoveTagFromSelectedProjects(e, tag._id)
                      : handleAddTagToSelectedProjects(e, tag._id)
                  }
                  aria-label={t('add_or_remove_project_from_tag', {
                    tagName: tag.name,
                  })}
                >
                  <Icon
                    type={
                      containsAllSelectedProjects(tag)
                        ? 'check-square-o'
                        : containsSomeSelectedProjects(tag)
                        ? 'minus-square-o'
                        : 'square-o'
                    }
                    className="tag-checkbox"
                  />{' '}
                  <span
                    className="tag-dot"
                    style={{
                      backgroundColor: getTagColor(tag),
                    }}
                  />{' '}
                  {tag.name}
                </Button>
              </li>
            )
          })}
          <li className="divider" />
          <li>
            <Button
              className="tag-dropdown-button"
              onClick={handleOpenCreateTagModal}
            >
              {t('create_new_tag')}
            </Button>
          </li>
        </Dropdown.Menu>
      </ControlledDropdown>
      <CreateTagModal id="toolbar-create-tag-modal" />
    </>
  )
}

export default memo(TagsDropdown)
