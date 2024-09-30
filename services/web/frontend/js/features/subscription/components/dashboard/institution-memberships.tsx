import { Trans } from 'react-i18next'
import { Institution } from '../../../../../../types/institution'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import OLNotification from '@/features/ui/components/ol/ol-notification'

function InstitutionMemberships() {
  const { institutionMemberships } = useSubscriptionDashboardContext()

  // memberships is undefined when data failed to load. If user has no memberships, then an empty array is returned

  if (!institutionMemberships) {
    return (
      <OLNotification
        type="warning"
        content={
          <p>
            Sorry, something went wrong. Subscription information related to
            institutional affiliations may not be displayed. Please try again
            later.
          </p>
        }
      />
    )
  }

  if (!institutionMemberships.length) return null

  return (
    <div>
      {institutionMemberships.map((institution: Institution) => (
        <div key={`${institution.id}`}>
          <Trans
            i18nKey="you_are_on_x_plan_as_a_confirmed_member_of_institution_y"
            values={{
              planName: 'Professional',
              institutionName: institution.name || '',
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a href="/user/subscription/plans" rel="noopener" />,
              // eslint-disable-next-line react/jsx-key
              <strong />,
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
          <hr />
        </div>
      ))}
    </div>
  )
}

export default InstitutionMemberships
