import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAsync from '../../../../shared/hooks/use-async'
import {
  getUserFacingMessage,
  postJSON,
} from '../../../../infrastructure/fetch-json'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import { useLocation } from '../../../../shared/hooks/use-location'
import Notification from '@/shared/components/notification'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLForm from '@/features/ui/components/ol/ol-form'

type NewProjectData = {
  project_id: string
  owner_ref: string
  owner: {
    first_name: string
    last_name: string
    email: string
    id: string
  }
}

type Props = {
  onCancel: () => void
  template?: string
}

function ModalContentNewProjectForm({ onCancel, template = 'none' }: Props) {
  const { t } = useTranslation()
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()
  const [projectName, setProjectName] = useState('')
  const { isLoading, isError, error, runAsync } = useAsync<NewProjectData>()
  const location = useLocation()

  const createNewProject = () => {
    runAsync(
      postJSON('/project/new', {
        body: {
          projectName,
          template,
        },
      })
    )
      .then(data => {
        if (data.project_id) {
          location.assign(`/project/${data.project_id}`)
        }
      })
      .catch(() => {})
  }

  const handleChangeName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(e.currentTarget.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createNewProject()
  }

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('new_project')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {isError && (
          <div className="notification-list">
            <Notification
              type="error"
              content={getUserFacingMessage(error) as string}
            />
          </div>
        )}
        <OLForm onSubmit={handleSubmit}>
          <OLFormControl
            type="text"
            ref={autoFocusedRef}
            placeholder={t('project_name')}
            onChange={handleChangeName}
            value={projectName}
          />
        </OLForm>
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={createNewProject}
          disabled={projectName === '' || isLoading}
          isLoading={isLoading}
        >
          {t('create')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

export default ModalContentNewProjectForm
