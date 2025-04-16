import { memo, useCallback, useEffect } from 'react'
import Notification from './notification'
import { Trans, useTranslation } from 'react-i18next'
import OLButton from '@/features/ui/components/ol/ol-button'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import { sendMB } from '@/infrastructure/event-tracking'

function PapersNotificationBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = usePersistedState(
    'papers-notification-banner-dismissed',
    false
  )

  useEffect(() => {
    if (!dismissed) {
      sendMB('promo-prompt', {
        location: 'dashboard-banner',
        name: 'papers-integration',
      })
    }
  }, [dismissed])

  const handleClose = useCallback(() => {
    sendMB('promo-dismiss', {
      location: 'dashboard-banner',
      name: 'papers-integration',
    })
    setDismissed(true)
  }, [setDismissed])

  const handlePapersButtonClick = useCallback(() => {
    sendMB('promo-click', {
      location: 'dashboard-banner',
      name: 'papers-integration',
      type: 'click-try-for-free',
    })
  }, [])

  const handleSettingsLinkClick = useCallback(() => {
    sendMB('promo-click', {
      location: 'dashboard-banner',
      name: 'papers-integration',
      type: 'click-link-account',
    })
  }, [])

  if (dismissed) return null

  return (
    <Notification
      type="info"
      title={t(
        'you_can_now_sync_your_papers_library_directly_with_your_overleaf_projects'
      )}
      onDismiss={handleClose}
      content={
        <p>
          <Trans
            i18nKey="already_have_a_papers_account"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a
                onClick={handleSettingsLinkClick}
                href="/user/settings#references"
              />,
            ]}
          />
        </p>
      }
      action={
        <OLButton
          variant="secondary"
          onClick={handlePapersButtonClick}
          href="https://www.papersapp.com/30-day-trial/?utm_source=overleaf_inproduct&utm_medium=referral&utm_campaign=overleaf_integration"
          target="_blank"
          rel="noreferrer"
        >
          {t('try_papers_for_free')}
        </OLButton>
      }
    />
  )
}

export default memo(PapersNotificationBanner)
