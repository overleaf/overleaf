import { createContext, FC, useCallback, useContext, useState } from 'react'

const GlobalAlertsContext = createContext<HTMLDivElement | null | undefined>(
  undefined
)

export const GlobalAlertsProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [globalAlertsContainer, setGlobalAlertsContainer] =
    useState<HTMLDivElement | null>(null)

  const handleGlobalAlertsContainer = useCallback(
    (node: HTMLDivElement | null) => {
      setGlobalAlertsContainer(node)
    },
    []
  )

  return (
    <GlobalAlertsContext.Provider value={globalAlertsContainer}>
      <div className="global-alerts" ref={handleGlobalAlertsContainer} />
      {children}
    </GlobalAlertsContext.Provider>
  )
}

export const useGlobalAlertsContainer = () => {
  const context = useContext(GlobalAlertsContext)

  if (context === undefined) {
    throw new Error(
      'useGlobalAlertsContainer is only available inside GlobalAlertsProvider'
    )
  }

  return context
}
