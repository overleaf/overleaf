import { useCallback, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { postJSON } from '../../../../infrastructure/fetch-json'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { ManagedInstitution as Institution } from '../../../../../../types/subscription/dashboard/managed-institution'
import { RowLink } from './row-link'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import OLButton from '@/shared/components/ol/ol-button'

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
    (
      e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
      institutionId: Institution['v1Id']
    ) => {
      const updateSubscription = async (institutionId: Institution['v1Id']) => {
        setSubscriptionChanging(true)
        try {
          const data = await postJSON<string[]>(
            `/institutions/${institutionId}/emailSubscription`
          )
          institution.metricsEmail.optedOutUserIds = data
          updateManagedInstitution(institution)
        } catch (error) {
          debugConsole.error(error)
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
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      </p>
      <ul className="list-group p-0">
        <RowLink
          href={`/metrics/institutions/${institution.v1Id}`}
          heading={t('view_metrics')}
          subtext={t('view_metrics_commons_subtext')}
          icon="insights"
        />
        <RowLink
          href={`/institutions/${institution.v1Id}/hub`}
          heading={t('view_hub')}
          subtext={t('view_hub_subtext')}
          icon="account_circle"
        />
        <RowLink
          href={`/manage/institutions/${institution.v1Id}/managers`}
          heading={t('manage_institution_managers')}
          subtext={t('manage_managers_subtext')}
          icon="manage_accounts"
        />
      </ul>
      <div>
        <p>
          <span>Monthly metrics emails: </span>
          {subscriptionChanging ? (
            <i className="fa fa-spin fa-refresh" />
          ) : (
            <OLButton
              variant="link"
              className="btn-inline-link"
              onClick={e =>
                changeInstitutionalEmailSubscription(e, institution.v1Id)
              }
            >
              {institution.metricsEmail.optedOutUserIds.includes(
                getMeta('ol-user_id')!
              )
                ? t('subscribe')
                : t('unsubscribe')}
            </OLButton>
          )}
        </p>
      </div>
      <hr />
    </div>
  )
}
