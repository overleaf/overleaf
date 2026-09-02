import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { useLocation } from '@/shared/hooks/use-location'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { useAsync } from '@/shared/hooks/use-async-with-cancel'

export default function UnlinkCommonsSSOModal({
  show,
  onClose,
  institutionName,
  institutionEmail,
  hasLicence,
}: {
  show: boolean
  onClose: () => void
  institutionName: string
  institutionEmail: string
  hasLicence: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const hasPassword = getMeta('ol-hasPassword')
  const { isLoading, isError, runAsync, reset } = useAsync()

  function handleClose() {
    reset()
    onClose()
  }

  function handleUnlinkSSO() {
    runAsync(signal =>
      postJSON('/saml/unlink-commons', {
        body: { institutionEmail },
        signal,
      })
    )
      .then(() => {
        handleClose()
        location.reload()
      })
      .catch(error => {
        debugConsole.error('Error unlinking SSO account', error)
      })
  }

  return (
    <OLModal
      id={`unlink-${institutionEmail}-sso-modal`}
      show={show}
      onHide={handleClose}
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('unlink_commons_sso_title')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>{t('unlink_commons_sso_confirm', { institutionName })}</p>
        <p>{t('unlink_commons_sso_troubleshoot')}</p>
        {hasLicence && <p>{t('unlink_commons_sso_lose_licence')}</p>}
        {!hasPassword && <p>{t('unlink_commons_sso_no_login')}</p>}
        {isError && (
          <div className="notification-list">
            <Notification
              type="error"
              content={t('unlink_commons_sso_error')}
            />
          </div>
        )}
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          disabled={isLoading}
          variant="secondary"
          onClick={handleClose}
        >
          {t('cancel')}
        </OLButton>
        <OLButton
          disabled={isLoading}
          variant="danger"
          onClick={handleUnlinkSSO}
          isLoading={isLoading}
          loadingLabel={t('unlinking')}
        >
          {t('unlink')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
