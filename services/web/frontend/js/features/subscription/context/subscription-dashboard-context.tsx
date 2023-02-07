import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import {
  ManagedGroupSubscription,
  Subscription,
} from '../../../../../types/subscription/dashboard/subscription'
import { Plan } from '../../../../../types/subscription/plan'
import { Institution } from '../../../../../types/institution'
import getMeta from '../../../utils/meta'

type SubscriptionDashboardContextValue = {
  hasDisplayedSubscription: boolean
  institutionMemberships?: Array<Institution>
  managedGroupSubscriptions: Array<ManagedGroupSubscription>
  personalSubscription?: Subscription
  plans: Array<Plan>
  recurlyLoadError: boolean
  setRecurlyLoadError: React.Dispatch<React.SetStateAction<boolean>>
  showCancellation: boolean
  setShowCancellation: React.Dispatch<React.SetStateAction<boolean>>
  showChangePersonalPlan: boolean
  setShowChangePersonalPlan: React.Dispatch<React.SetStateAction<boolean>>
}

export const SubscriptionDashboardContext = createContext<
  SubscriptionDashboardContextValue | undefined
>(undefined)

export function SubscriptionDashboardProvider({
  children,
}: {
  children: ReactNode
}) {
  const [recurlyLoadError, setRecurlyLoadError] = useState(false)
  const [showCancellation, setShowCancellation] = useState(false)
  const [showChangePersonalPlan, setShowChangePersonalPlan] = useState(false)

  const plans = getMeta('ol-plans')
  const institutionMemberships = getMeta('ol-currentInstitutionsWithLicence')
  const personalSubscription = getMeta('ol-subscription')
  const managedGroupSubscriptions = getMeta('ol-managedGroupSubscriptions')

  const hasDisplayedSubscription =
    institutionMemberships?.length > 0 ||
    personalSubscription ||
    managedGroupSubscriptions

  const value = useMemo<SubscriptionDashboardContextValue>(
    () => ({
      hasDisplayedSubscription,
      institutionMemberships,
      managedGroupSubscriptions,
      personalSubscription,
      plans,
      recurlyLoadError,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      showChangePersonalPlan,
      setShowChangePersonalPlan,
    }),
    [
      hasDisplayedSubscription,
      institutionMemberships,
      managedGroupSubscriptions,
      personalSubscription,
      plans,
      recurlyLoadError,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      showChangePersonalPlan,
      setShowChangePersonalPlan,
    ]
  )

  return (
    <SubscriptionDashboardContext.Provider value={value}>
      {children}
    </SubscriptionDashboardContext.Provider>
  )
}

export function useSubscriptionDashboardContext() {
  const context = useContext(SubscriptionDashboardContext)
  if (!context) {
    throw new Error(
      'SubscriptionDashboardContext is only available inside SubscriptionDashboardProvider'
    )
  }
  return context
}
