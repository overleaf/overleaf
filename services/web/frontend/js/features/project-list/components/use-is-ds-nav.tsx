import { createContext, type FC, type ReactNode, useContext } from 'react'
import { useSplitTestContext } from '@/shared/context/split-test-context'

/**
 * This hook returns whether the user has the split-test assignment 'sidebar-navigation-ui-update'
 */
export const useIsDsNav = () => {
  const { splitTestVariants } = useSplitTestContext()
  return splitTestVariants['sidebar-navigation-ui-update'] === 'active'
}

/**
 * This context wraps elements that should be styled according to the sidebar-navigation-ui-update redesign
 * It doesn't exactly match the split-test assignment because it's only used in the project-list page
 */
const DsNavStyleContext = createContext<boolean | undefined>(undefined)

export const DsNavStyleProvider: FC<{
  children: ReactNode
}> = ({ children }) => (
  <DsNavStyleContext.Provider value>{children}</DsNavStyleContext.Provider>
)

export const useDsNavStyle = () => {
  const context = useContext(DsNavStyleContext)
  return context ?? false
}
