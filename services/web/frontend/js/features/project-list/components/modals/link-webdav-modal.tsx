import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import Notification from '@/shared/components/notification'
import { linkWebDAV } from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'

type LinkWebDAVModalProps = {
  projectId: string
  showModal: boolean
  handleCloseModal: () => void
  onSuccess?: () => void
}

function LinkWebDAVModal({
  projectId,
  showModal,
  handleCloseModal,
  onSuccess,
}: LinkWebDAVModalProps) {
  const { t } = useTranslation()
  const [webdavUrl, setWebdavUrl] = useState('')
  const [webdavUsername, setWebdavUsername] = useState('')
  const [webdavPassword, setWebdavPassword] = useState('')
  const [webdavBasePath, setWebdavBasePath] = useState('/overleaf')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!webdavUrl.trim()) {
      setError(t('webdav_url_required'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await linkWebDAV(projectId, {
        url: webdavUrl.trim(),
        username: webdavUsername.trim(),
        password: webdavPassword,
        basePath: webdavBasePath.trim() || '/overleaf',
      })
      
      if (onSuccess) {
        onSuccess()
      }
      handleCloseModal()
    } catch (err) {
      setError(getUserFacingMessage(err) as string)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setWebdavUrl('')
    setWebdavUsername('')
    setWebdavPassword('')
    setWebdavBasePath('/overleaf')
    setError(null)
    handleCloseModal()
  }

  return (
    <OLModal show={showModal} onHide={handleClose}>
      <OLModalHeader>
        <OLModalTitle>{t('link_to_webdav')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {error && (
          <div className="notification-list">
            <Notification type="error" content={error} />
          </div>
        )}

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
          <OLFormLabel>{t('webdav_username')}</OLFormLabel>
          <OLFormControl
            type="text"
            value={webdavUsername}
            onChange={e => setWebdavUsername(e.target.value)}
          />
        </OLFormGroup>

        <OLFormGroup controlId="webdav-password">
          <OLFormLabel>{t('webdav_password')}</OLFormLabel>
          <OLFormControl
            type="password"
            value={webdavPassword}
            onChange={e => setWebdavPassword(e.target.value)}
          />
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
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleClose}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={handleSubmit}
          disabled={!webdavUrl.trim() || isLoading}
          isLoading={isLoading}
        >
          {t('link')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default LinkWebDAVModal
