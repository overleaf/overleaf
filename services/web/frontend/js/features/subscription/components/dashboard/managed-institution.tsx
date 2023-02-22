import { useCallback, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { postJSON } from '../../../../infrastructure/fetch-json'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { Institution } from './managed-institutions'

type ManagedInstitutionProps = {
  institution: Institution
}

export default function ManagedInstitution({
  institution,
}: ManagedInstitutionProps) {
  const { t } = useTranslation()
  const [subscriptionChanging, setSubscriptionChanging] = useState(false)
  const { updateManagedInstitution } = useSubscriptionDashboardContext()

  const changeInstitutionalEmailSubscription = useCallback(
    (e, institutionId: Institution['v1Id']) => {
      const updateSubscription = async (institutionId: Institution['v1Id']) => {
        setSubscriptionChanging(true)
        try {
          const data = await postJSON<string[]>(
            `/institutions/${institutionId}/emailSubscription`
          )
          institution.metricsEmail.optedOutUserIds = data
          updateManagedInstitution(institution)
        } catch (error) {
          console.error(error)
        }
        setSubscriptionChanging(false)
      }

      e.preventDefault()
      updateSubscription(institutionId)
    },
    [institution, updateManagedInstitution]
  )

  return (
    <div>
      <p>
        <Trans
          i18nKey="you_are_a_manager_of_commons_at_institution_x"
          components={[<strong />]} // eslint-disable-line react/jsx-key
          values={{
            institutionName: institution.name || '',
          }}
        />
      </p>
      <p>
        <a
          className="btn btn-primary"
          href={`/metrics/institutions/${institution.v1Id}`}
        >
          <i className="fa fa-fw fa-line-chart" /> {t('view_metrics')}
        </a>
      </p>
      <p>
        <a href={`/institutions/${institution.v1Id}/hub`}>
          <i className="fa fa-fw fa-user-circle" /> {t('view_hub')}
        </a>
      </p>
      <p>
        <a href={`/manage/institutions/${institution.v1Id}/managers`}>
          <i className="fa fa-fw fa-users" /> {t('manage_institution_managers')}
        </a>
      </p>
      <div>
        <p>
          <span>Monthly metrics emails: </span>
          {subscriptionChanging ? (
            <i className="fa fa-spin fa-refresh" />
          ) : (
            <button
              className="btn-inline-link"
              style={{ border: 0 }}
              onClick={e =>
                changeInstitutionalEmailSubscription(e, institution.v1Id)
              }
            >
              {institution.metricsEmail.optedOutUserIds.includes(
                window.user_id!
              )
                ? t('subscribe')
                : t('unsubscribe')}
            </button>
          )}
        </p>
      </div>
      <hr />
    </div>
  )
}
