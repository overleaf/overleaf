import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useState,
} from 'react'

export type NestableDropdownContextType = {
  selected: string | null
  setSelected: Dispatch<SetStateAction<string | null>>
  menuId: string
}

export const NestableDropdownContext = createContext<
  NestableDropdownContextType | undefined
>(undefined)

export const NestableDropdownContextProvider: FC<
  React.PropsWithChildren<{ id: string }>
> = ({ id, children }) => {
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      // unset selection on unmount
      setSelected(null)
    }
  }, [])

  return (
    <NestableDropdownContext.Provider
      value={{ selected, setSelected, menuId: id }}
    >
      {children}
    </NestableDropdownContext.Provider>
  )
}
