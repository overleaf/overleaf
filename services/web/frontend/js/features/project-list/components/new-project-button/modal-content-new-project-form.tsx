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
} from '@/shared/components/ol/ol-modal'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import { Collapse } from 'react-bootstrap'

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
  const [redirecting, setRedirecting] = useState(false)
  const [showWebDAVConfig, setShowWebDAVConfig] = useState(false)
  const [webdavUrl, setWebdavUrl] = useState('')
  const [webdavBasePath, setWebdavBasePath] = useState('/overleaf')
  const [useUsername, setUseUsername] = useState(false)
  const [webdavUsername, setWebdavUsername] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [webdavPassword, setWebdavPassword] = useState('')
  const { isLoading, isError, error, runAsync } = useAsync<NewProjectData>()
  const location = useLocation()

  const createNewProject = () => {
    const body: {
      projectName: string
      template: string
      webdavConfig?: {
        url: string
        basePath: string
        useUsername: boolean
        username: string
        usePassword: boolean
        password: string
      }
    } = {
      projectName,
      template,
    }

    // Include webdavConfig only if URL is provided
    if (webdavUrl.trim()) {
      body.webdavConfig = {
        url: webdavUrl.trim(),
        basePath: webdavBasePath.trim() || '/overleaf',
        useUsername,
        username: useUsername ? webdavUsername.trim() : '',
        usePassword,
        password: usePassword ? webdavPassword : '',
      }
    }

    runAsync(
      postJSON('/project/new', {
        body,
      })
    )
      .then(data => {
        if (data.project_id) {
          // prevents clicking on create again between async load of next page and pending state being finished
          setRedirecting(true)
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
      <OLModalHeader>
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
          <OLFormGroup controlId="project-name">
            <OLFormLabel>{t('project_name')}</OLFormLabel>
            <OLFormControl
              type="text"
              ref={autoFocusedRef}
              onChange={handleChangeName}
              value={projectName}
            />
          </OLFormGroup>

          <div className="mb-3">
            <button
              type="button"
              className="btn btn-link p-0"
              onClick={() => setShowWebDAVConfig(!showWebDAVConfig)}
              aria-expanded={showWebDAVConfig}
            >
              {showWebDAVConfig ? '▼' : '▶'} {t('cloud_storage_optional')}
            </button>
          </div>

          <Collapse in={showWebDAVConfig}>
            <div>
              <OLFormGroup controlId="webdav-url">
                <OLFormLabel>{t('webdav_url')}</OLFormLabel>
                <OLFormControl
                  type="text"
                  placeholder="https://nextcloud.example.com/remote.php/dav/files/username/"
                  value={webdavUrl}
                  onChange={e => setWebdavUrl(e.target.value)}
                />
              </OLFormGroup>

              <OLFormGroup controlId="webdav-username">
                <OLFormCheckbox
                  label={t('use_username')}
                  checked={useUsername}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseUsername(e.target.checked)}
                />
                {useUsername && (
                  <OLFormControl
                    type="text"
                    value={webdavUsername}
                    onChange={e => setWebdavUsername(e.target.value)}
                    className="mt-2"
                  />
                )}
              </OLFormGroup>

              <OLFormGroup controlId="webdav-password">
                <OLFormCheckbox
                  label={t('use_password')}
                  checked={usePassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsePassword(e.target.checked)}
                />
                {usePassword && (
                  <OLFormControl
                    type="password"
                    value={webdavPassword}
                    onChange={e => setWebdavPassword(e.target.value)}
                    className="mt-2"
                  />
                )}
              </OLFormGroup>

              <OLFormGroup controlId="webdav-base-path">
                <OLFormLabel>{t('webdav_base_path')}</OLFormLabel>
                <OLFormControl
                  type="text"
                  value={webdavBasePath}
                  onChange={e => setWebdavBasePath(e.target.value)}
                  placeholder="/overleaf"
                />
              </OLFormGroup>
            </div>
          </Collapse>
        </OLForm>
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={createNewProject}
          disabled={projectName === '' || isLoading || redirecting}
          isLoading={isLoading}
          loadingLabel={t('creating')}
        >
          {t('create')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

export default ModalContentNewProjectForm
