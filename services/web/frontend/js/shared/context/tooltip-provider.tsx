import {
  createContext,
  Dispatch,
  FC,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react'
import useDebounce from '@/shared/hooks/use-debounce'

const TooltipContext = createContext<
  | {
      isTooltipOpen: boolean
      setIsTooltipOpen: Dispatch<SetStateAction<boolean>>
    }
  | undefined
>(undefined)

export const TooltipProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)

  const debouncedIsTooltipOpen = useDebounce(isTooltipOpen, 100)

  const value = useMemo(
    () => ({
      isTooltipOpen: debouncedIsTooltipOpen,
      setIsTooltipOpen,
    }),
    [debouncedIsTooltipOpen, setIsTooltipOpen]
  )

  return (
    <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>
  )
}

export const useTooltipContext = () => {
  return useContext(TooltipContext)
}
