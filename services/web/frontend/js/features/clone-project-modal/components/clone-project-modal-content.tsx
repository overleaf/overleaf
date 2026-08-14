/* eslint-disable jsx-a11y/no-autofocus */
import { FormEvent, useCallback, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { postJSON, FetchError } from '@/infrastructure/fetch-json.ts'
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
import getMeta from '@/utils/meta.ts'
import { useFeatureFlag } from '@/shared/context/split-test-context'

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
  const { maxUploadSize } = getMeta('ol-ExposedSettings')
  const themed = useFeatureFlag('themed-modals')

  const [error, setError] = useState<FetchError | null>(null)
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

    setError(null)
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
      .catch(err => {
        setError(err)
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
                    themed={themed}
                  />
                ))}
              </div>
            </OLFormGroup>
          )}
        </OLForm>

        {error && (
          <Notification
            content={
              error.getErrorMessageKey() === 'file_too_large_to_copy' ? (
                <Trans
                  components={[<code key="code-for-path" />]}
                  i18nKey="file_too_large_to_copy"
                  values={{
                    size: (error.data.message.info.size / 1024 / 1024).toFixed(
                      1
                    ),
                    limit: Math.floor(maxUploadSize / 1024 / 1024),
                    path: error.data.message.info.path,
                  }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                ></Trans>
              ) : error.response?.status === 400 ? (
                error.data.message
              ) : (
                t('generic_something_went_wrong')
              )
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
