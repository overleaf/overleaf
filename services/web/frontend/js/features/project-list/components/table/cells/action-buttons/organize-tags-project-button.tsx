import { FormEvent, memo, useCallback, useEffect, useState } from 'react'
import { sortBy } from 'lodash'
import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import { Tag } from '../../../../../../../../app/src/Features/Tags/types'
import { useProjectListContext } from '../../../../context/project-list-context'
import {
  addProjectsToTag,
  createTag,
  removeProjectFromTag,
} from '../../../../util/api'
import { getTagColor, MAX_TAG_LENGTH } from '../../../../util/tag'

type OrganizeTagsProjectButtonProps = {
  project: Project
  children: (text: string, openModal: () => void) => React.ReactElement
}

function OrganizeProjectTagsModal({
  project,
  show,
  onClose,
}: {
  project: Project
  show: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const themed = useFeatureFlag('themed-modals')
  const {
    tags,
    addTag,
    addProjectToTagInView,
    removeProjectFromTagInView,
  } = useProjectListContext()

  const [newTagName, setNewTagName] = useState('')
  const [creating, setCreating] = useState(false)
  const [pendingTagId, setPendingTagId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (show) {
      setNewTagName('')
      setErrorMessage(null)
    }
  }, [show])

  const handleToggleTag = useCallback(
    async (tagId: string, currentlySelected: boolean) => {
      if (pendingTagId) return
      setPendingTagId(tagId)
      setErrorMessage(null)
      if (currentlySelected) {
        removeProjectFromTagInView(tagId, project.id)
      } else {
        addProjectToTagInView(tagId, project.id)
      }
      try {
        if (currentlySelected) {
          await removeProjectFromTag(tagId, project.id)
        } else {
          await addProjectsToTag(tagId, [project.id])
        }
      } catch {
        if (currentlySelected) {
          addProjectToTagInView(tagId, project.id)
        } else {
          removeProjectFromTagInView(tagId, project.id)
        }
        setErrorMessage(t('generic_something_went_wrong'))
      } finally {
        setPendingTagId(null)
      }
    },
    [
      addProjectToTagInView,
      pendingTagId,
      project.id,
      removeProjectFromTagInView,
      t,
    ]
  )

  const handleCreateAndAssign = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = newTagName.trim()
      if (!trimmed || creating) return
      if (trimmed.length > MAX_TAG_LENGTH) {
        setErrorMessage(
          t('tag_name_cannot_exceed_characters', { maxLength: MAX_TAG_LENGTH })
        )
        return
      }
      const existing = tags.find(
        tag => tag.name?.trim().toLowerCase() === trimmed.toLowerCase()
      )
      if (existing) {
        if (!existing.project_ids?.includes(project.id)) {
          await handleToggleTag(existing._id, false)
        }
        setNewTagName('')
        return
      }

      setCreating(true)
      setErrorMessage(null)
      try {
        const created = await createTag(trimmed)
        addTag(created)
        addProjectToTagInView(created._id, project.id)
        await addProjectsToTag(created._id, [project.id])
        setNewTagName('')
      } catch {
        setErrorMessage(t('generic_something_went_wrong'))
      } finally {
        setCreating(false)
      }
    },
    [
      addProjectToTagInView,
      addTag,
      creating,
      handleToggleTag,
      newTagName,
      project.id,
      t,
      tags,
    ]
  )

  if (!show) return null

  const sortedTags = sortBy(tags, tag => tag.name?.toLowerCase())

  return (
    <OLModal
      show
      animation
      onHide={onClose}
      id={`organize-tags-modal-${project.id}`}
      themed={themed}
      className="project-list-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>{t('organize_tags')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p className="text-muted small mb-3" translate="no">
          {project.name}
        </p>

        {errorMessage && (
          <div className="notification-list mb-3">
            <Notification type="error" content={errorMessage} />
          </div>
        )}

        {sortedTags.length === 0 ? (
          <div className="ol-organize-tags-empty mb-3">
            No tags yet. Create your first tag below.
          </div>
        ) : (
          <div className="ol-organize-tags-list mb-3">
            {sortedTags.map(tag => {
              const checked = Boolean(tag.project_ids?.includes(project.id))
              return (
                <div key={tag._id} className="ol-organize-tags-row">
                  <OLFormCheckbox
                    id={`organize-tag-${project.id}-${tag._id}`}
                    checked={checked}
                    disabled={pendingTagId === tag._id}
                    onChange={() => handleToggleTag(tag._id, checked)}
                    label={
                      <span className="ol-organize-tags-label" translate="no">
                        <i
                          className="badge-tag-circle"
                          style={{ backgroundColor: getTagColor(tag) }}
                          aria-hidden="true"
                        />
                        <span className="text-truncate">{tag.name}</span>
                      </span>
                    }
                  />
                </div>
              )
            })}
          </div>
        )}

        <OLForm onSubmit={handleCreateAndAssign}>
          <div className="ol-organize-tags-create-row">
            <OLFormControl
              type="text"
              size="sm"
              maxLength={MAX_TAG_LENGTH}
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              placeholder={t('new_tag_name')}
              aria-label={t('new_tag_name')}
              disabled={creating}
            />
            <OLButton
              variant="secondary"
              size="sm"
              type="submit"
              isLoading={creating}
              loadingLabel={t('creating')}
              disabled={creating || !newTagName.trim()}
            >
              {t('create')}
            </OLButton>
          </div>
        </OLForm>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="primary" type="button" onClick={onClose}>
          Done
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

function OrganizeTagsProjectButton({
  project,
  children,
}: OrganizeTagsProjectButtonProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  if (project.archived || project.trashed) {
    return null
  }

  return (
    <>
      {children(t('organize_tags'), handleOpenModal)}
      <OrganizeProjectTagsModal
        project={project}
        show={showModal}
        onClose={handleCloseModal}
      />
    </>
  )
}

export default memo(OrganizeTagsProjectButton)
