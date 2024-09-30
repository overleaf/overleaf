import { useTranslation, Trans } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import getMeta from '../../../../utils/meta'
import useAsync from '../../../../shared/hooks/use-async'
import { postJSON } from '../../../../infrastructure/fetch-json'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'

function PersonalSubscriptionRecurlySyncEmail() {
  const { t } = useTranslation()
  const { personalSubscription } = useSubscriptionDashboardContext()
  const userEmail = getMeta('ol-usersEmail')
  const { isLoading, isSuccess, runAsync } = useAsync()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runAsync(postJSON('/user/subscription/account/email'))
  }

  if (!personalSubscription || !('recurly' in personalSubscription)) return null

  const recurlyEmail = personalSubscription.recurly.account.email

  if (!userEmail || recurlyEmail === userEmail) return null

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
                  values={{ recurlyEmail, userEmail }}
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
                  bs3Props={{
                    loading: isLoading ? t('updating') + '…' : t('update'),
                  }}
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

export default PersonalSubscriptionRecurlySyncEmail
