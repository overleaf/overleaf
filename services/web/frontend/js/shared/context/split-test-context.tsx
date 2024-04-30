import { createContext, FC, useContext, useMemo } from 'react'
import getMeta from '../../utils/meta'

type SplitTestVariants = Record<string, any>
type SplitTestInfo = Record<string, any>

export const SplitTestContext = createContext<
  | {
      splitTestVariants: SplitTestVariants
      splitTestInfo: SplitTestInfo
    }
  | undefined
>(undefined)

export const SplitTestProvider: FC = ({ children }) => {
  const value = useMemo(
    () => ({
      splitTestVariants: getMeta('ol-splitTestVariants') || {},
      splitTestInfo: getMeta('ol-splitTestInfo') || {},
    }),
    []
  )

  return (
    <SplitTestContext.Provider value={value}>
      {children}
    </SplitTestContext.Provider>
  )
}

export function useSplitTestContext() {
  const context = useContext(SplitTestContext)

  if (!context) {
    throw new Error(
      'useSplitTestContext is only available within SplitTestProvider'
    )
  }

  return context
}

export function useFeatureFlag(name: string) {
  const { splitTestVariants } = useSplitTestContext()
  return splitTestVariants[name] === 'enabled'
}
