/* eslint-disable jsx-a11y/no-autofocus */
import { FormEvent, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON } from '../../../infrastructure/fetch-json'
import { CloneProjectTag } from './clone-project-tag'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import Notification from '@/shared/components/notification'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLButton from '@/shared/components/ol/ol-button'
import { Tag } from '../../../../../app/src/Features/Tags/types'

export default function CloneProjectModalContent({
  handleHide,
  inFlight,
  setInFlight,
  handleAfterCloned,
  projectId,
  projectName,
  projectTags,
}: {
  handleHide: () => void
  inFlight: boolean
  setInFlight: (inFlight: boolean) => void
  handleAfterCloned: (clonedProject: any, tags: Tag[]) => void
  projectId: string
  projectName: string
  projectTags: Tag[]
}) {
  const { t } = useTranslation()

  const [error, setError] = useState<string | boolean>()
  const [clonedProjectName, setClonedProjectName] = useState(
    `${projectName} (Copy)`
  )

  const [clonedProjectTags, setClonedProjectTags] = useState(projectTags)

  // valid if the cloned project has a name
  const valid = useMemo(
    () => clonedProjectName.trim().length > 0,
    [clonedProjectName]
  )

  // form submission: clone the project if the name is valid
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!valid) {
      return
    }

    setError(false)
    setInFlight(true)

    // clone the project
    postJSON(`/project/${projectId}/clone`, {
      body: {
        projectName: clonedProjectName,
        tags: clonedProjectTags.map(tag => ({ id: tag._id })),
      },
    })
      .then(data => {
        // open the cloned project
        handleAfterCloned(data, clonedProjectTags)
      })
      .catch(({ response, data }) => {
        if (response?.status === 400) {
          setError(data.message)
        } else {
          setError(true)
        }
      })
      .finally(() => {
        setInFlight(false)
      })
  }

  const removeTag = useCallback((tag: Tag) => {
    setClonedProjectTags(value => value.filter(item => item._id !== tag._id))
  }, [])

  return (
    <>
      <OLModalHeader>
        <OLModalTitle>{t('copy_project')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <OLForm id="clone-project-form" onSubmit={handleSubmit}>
          <OLFormGroup controlId="clone-project-form-name">
            <OLFormLabel>{t('new_name')}</OLFormLabel>
            <OLFormControl
              type="text"
              required
              value={clonedProjectName}
              onChange={event => setClonedProjectName(event.target.value)}
              autoFocus
            />
          </OLFormGroup>

          {clonedProjectTags.length > 0 && (
            <OLFormGroup
              controlId="clone-project-tags-list"
              className="clone-project-tag"
            >
              <OLFormLabel>{t('tags')}: </OLFormLabel>
              <div role="listbox" id="clone-project-tags-list">
                {clonedProjectTags.map(tag => (
                  <CloneProjectTag
                    key={tag._id}
                    tag={tag}
                    removeTag={removeTag}
                  />
                ))}
              </div>
            </OLFormGroup>
          )}
        </OLForm>

        {error && (
          <Notification
            content={
              typeof error === 'string' && error.length
                ? error
                : t('generic_something_went_wrong')
            }
            type="error"
          />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" disabled={inFlight} onClick={handleHide}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          disabled={inFlight || !valid}
          form="clone-project-form"
          type="submit"
        >
          {inFlight ? <>{t('copying')}…</> : t('copy')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}
