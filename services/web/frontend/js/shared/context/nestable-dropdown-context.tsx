import { createContext, Dispatch, FC, SetStateAction, useState } from 'react'

export type NestableDropdownContextType = {
  selected: string | null
  setSelected: Dispatch<SetStateAction<string | null>>
  menuId: string
}

export const NestableDropdownContext = createContext<
  NestableDropdownContextType | undefined
>(undefined)

export const NestableDropdownContextProvider: FC<{ id: string }> = ({
  id,
  children,
}) => {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <NestableDropdownContext.Provider
      value={{ selected, setSelected, menuId: id }}
    >
      {children}
    </NestableDropdownContext.Provider>
  )
}
