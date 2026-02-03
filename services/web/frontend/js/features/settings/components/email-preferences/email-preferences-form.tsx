import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { postJSON, getUserFacingMessage } from '@/infrastructure/fetch-json'
import useAsync from '@/shared/hooks/use-async'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'
import getMeta from '@/utils/meta'

function EmailPreferencesForm() {
  const { t } = useTranslation()
  const initialSubscribed = getMeta('ol-newsletter-subscribed')
  const [subscribed, setSubscribed] = useState(initialSubscribed)
  const { isLoading, isSuccess, isError, error, runAsync } = useAsync()

  const handleToggleSubscription = () => {
    const endpoint = subscribed
      ? '/user/newsletter/unsubscribe'
      : '/user/newsletter/subscribe'

    runAsync(postJSON<{ subscribed: boolean }>(endpoint))
      .then(response => setSubscribed(response.subscribed))
      .catch(() => {})
  }

  return (
    <>
      {isError && (
        <OLNotification
          type="error"
          content={getUserFacingMessage(error)}
          className="mb-3"
        />
      )}
      {isSuccess && (
        <OLNotification
          type="success"
          content={t('thanks_settings_updated')}
          className="mb-3"
        />
      )}

      <p>
        {subscribed ? (
          <Trans
            i18nKey="newsletter_info_subscribed"
            components={{ 0: <strong /> }}
          />
        ) : (
          <Trans
            i18nKey="newsletter_info_unsubscribed"
            components={{ 0: <strong /> }}
          />
        )}
      </p>

      <p className="text-center">
        {subscribed ? (
          <OLButton
            variant="danger"
            onClick={handleToggleSubscription}
            disabled={isLoading}
            isLoading={isLoading}
            loadingLabel={`${t('saving')}…`}
          >
            {t('unsubscribe')}
          </OLButton>
        ) : (
          <OLButton
            variant="primary"
            onClick={handleToggleSubscription}
            disabled={isLoading}
            isLoading={isLoading}
            loadingLabel={`${t('saving')}…`}
          >
            {t('subscribe')}
          </OLButton>
        )}
      </p>

      {subscribed && <p>{t('newsletter_info_note')}</p>}
    </>
  )
}

export default EmailPreferencesForm
