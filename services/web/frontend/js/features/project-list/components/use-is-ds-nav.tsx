import { createContext, type FC, type ReactNode, useContext } from 'react'

/**
 * This context wraps elements that should be styled according to the sidebar-navigation-ui-update redesign
 * It doesn't exactly match the split-test assignment because it's only used in the project-list page
 */
const DsNavStyleContext = createContext<boolean | undefined>(undefined)

export const DsNavStyleProvider: FC<
  React.PropsWithChildren<{
    children: ReactNode
  }>
> = ({ children }) => (
  <DsNavStyleContext.Provider value>{children}</DsNavStyleContext.Provider>
)

export const useDsNavStyle = () => {
  const context = useContext(DsNavStyleContext)
  return context ?? false
}
