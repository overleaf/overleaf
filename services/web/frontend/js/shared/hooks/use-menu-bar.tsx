import { MenuBarContext } from '@/shared/context/menu-bar-context'
import { useContext } from 'react'

export const useMenuBar = () => {
  const context = useContext(MenuBarContext)
  if (context === undefined) {
    throw new Error('useMenuBarContext must be used within a MenuBarContext')
  }
  return context
}
