/* eslint-disable jsx-a11y/no-autofocus */
import PropTypes from 'prop-types'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON } from '../../../infrastructure/fetch-json'
import { CloneProjectTag } from './clone-project-tag'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import Notification from '@/shared/components/notification'
import OLForm from '@/features/ui/components/ol/ol-form'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLButton from '@/features/ui/components/ol/ol-button'

export default function CloneProjectModalContent({
  handleHide,
  inFlight,
  setInFlight,
  handleAfterCloned,
  projectId,
  projectName,
  projectTags,
}) {
  const { t } = useTranslation()

  const [error, setError] = useState()
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
  const handleSubmit = event => {
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

  const removeTag = useCallback(tag => {
    setClonedProjectTags(value => value.filter(item => item._id !== tag._id))
  }, [])

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('copy_project')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <OLForm id="clone-project-form" onSubmit={handleSubmit}>
          <OLFormGroup controlId="clone-project-form-name">
            <OLFormLabel>{t('new_name')}</OLFormLabel>
            <OLFormControl
              type="text"
              placeholder="New Project Name"
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
            content={error.length ? error : t('generic_something_went_wrong')}
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
CloneProjectModalContent.propTypes = {
  handleHide: PropTypes.func.isRequired,
  inFlight: PropTypes.bool,
  setInFlight: PropTypes.func.isRequired,
  handleAfterCloned: PropTypes.func.isRequired,
  projectId: PropTypes.string,
  projectName: PropTypes.string,
  projectTags: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
    })
  ),
}
