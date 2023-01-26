import { createContext, ReactNode, useContext, useMemo, useState } from 'react'

type SubscriptionDashboardContextValue = {
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
  const [showChangePersonalPlan, setShowChangePersonalPlan] = useState(false)

  const value = useMemo<SubscriptionDashboardContextValue>(
    () => ({
      showChangePersonalPlan,
      setShowChangePersonalPlan,
    }),
    [showChangePersonalPlan, setShowChangePersonalPlan]
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
