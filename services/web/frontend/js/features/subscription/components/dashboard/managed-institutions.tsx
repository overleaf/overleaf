import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import ManagedInstitution from './managed-institution'

export default function ManagedInstitutions() {
  const { managedInstitutions } = useSubscriptionDashboardContext()

  if (!managedInstitutions) {
    return null
  }

  return (
    <>
      {managedInstitutions.map(institution => (
        <ManagedInstitution
          institution={institution}
          key={`managed-institution-${institution.v1Id}`}
        />
      ))}
    </>
  )
}
