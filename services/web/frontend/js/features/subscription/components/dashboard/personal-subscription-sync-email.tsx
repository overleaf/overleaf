import { useTranslation, Trans } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import getMeta from '../../../../utils/meta'
import useAsync from '../../../../shared/hooks/use-async'
import { postJSON } from '../../../../infrastructure/fetch-json'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'

function PersonalSubscriptionSyncEmail() {
  const { t } = useTranslation()
  const { personalSubscription } = useSubscriptionDashboardContext()
  const userEmail = getMeta('ol-usersEmail')
  const { isLoading, isSuccess, runAsync } = useAsync()

  if (!personalSubscription || !('payment' in personalSubscription)) return null

  const accountEmail = personalSubscription.payment.accountEmail

  if (!userEmail || accountEmail === userEmail) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runAsync(postJSON('/user/subscription/account/email'))
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <OLFormGroup>
          {isSuccess ? (
            <OLNotification
              type="success"
              content={t('recurly_email_updated')}
            />
          ) : (
            <>
              <p>
                <Trans
                  i18nKey="recurly_email_update_needed"
                  components={[<em />, <em />]} // eslint-disable-line react/jsx-key
                  values={{ recurlyEmail: accountEmail, userEmail }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                />
              </p>
              <div>
                <OLButton
                  variant="primary"
                  type="submit"
                  disabled={isLoading}
                  isLoading={isLoading}
                  loadingLabel={t('updating')}
                >
                  {t('update')}
                </OLButton>
              </div>
            </>
          )}
        </OLFormGroup>
      </form>
      <hr />
    </>
  )
}

export default PersonalSubscriptionSyncEmail
