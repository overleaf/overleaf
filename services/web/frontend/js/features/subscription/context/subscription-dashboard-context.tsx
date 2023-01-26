import { createContext, ReactNode, useContext, useMemo, useState } from 'react'

type SubscriptionDashboardContextValue = {
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

  const value = useMemo<SubscriptionDashboardContextValue>(
    () => ({
      recurlyLoadError,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      showChangePersonalPlan,
      setShowChangePersonalPlan,
    }),
    [
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
