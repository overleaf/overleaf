import { useTranslation, Trans } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { FormGroup, Alert } from 'react-bootstrap'
import getMeta from '../../../../utils/meta'
import useAsync from '../../../../shared/hooks/use-async'
import { postJSON } from '../../../../infrastructure/fetch-json'

function PersonalSubscriptionRecurlySyncEmail() {
  const { t } = useTranslation()
  const { personalSubscription } = useSubscriptionDashboardContext()
  const userEmail = getMeta('ol-usersEmail') as string
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
        <FormGroup>
          {isSuccess ? (
            <Alert bsStyle="success">{t('recurly_email_updated')}</Alert>
          ) : (
            <>
              <p>
                <Trans
                  i18nKey="recurly_email_update_needed"
                  components={[<em />, <em />]} // eslint-disable-line react/jsx-key
                  values={{ recurlyEmail, userEmail }}
                />
              </p>
              <div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? <>{t('updating')}…</> : t('update')}
                </button>
              </div>
            </>
          )}
        </FormGroup>
      </form>
      <hr />
    </>
  )
}

export default PersonalSubscriptionRecurlySyncEmail
