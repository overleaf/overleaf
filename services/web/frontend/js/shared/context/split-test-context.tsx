import { createContext, FC, useContext, useMemo } from 'react'
import getMeta from '../../utils/meta'
import { SplitTestInfo } from '../../../../types/split-test'

export const SplitTestContext = createContext<
  | {
      splitTestVariants: Record<string, string>
      splitTestInfo: Record<string, SplitTestInfo>
    }
  | undefined
>(undefined)

export const SplitTestProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
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

export function useSplitTest(name: string): {
  variant: string | undefined
  info: SplitTestInfo | undefined
} {
  const { splitTestVariants, splitTestInfo } = useSplitTestContext()

  return {
    variant: splitTestVariants[name],
    info: splitTestInfo[name],
  }
}
