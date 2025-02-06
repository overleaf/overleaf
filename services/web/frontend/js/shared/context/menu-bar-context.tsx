import { createContext, Dispatch, SetStateAction } from 'react'

export type MenuBarContextType = {
  selected: string | null
  setSelected: Dispatch<SetStateAction<string | null>>
  menuId: string
}

export const MenuBarContext = createContext<MenuBarContextType | undefined>(
  undefined
)
