import { NestableDropdownContext } from '@/shared/context/nestable-dropdown-context'
import { useContext } from 'react'

export const useNestableDropdown = () => {
  const context = useContext(NestableDropdownContext)
  if (context === undefined) {
    throw new Error(
      'useNestableDropdown must be used within a NestableDropdownContextProvider'
    )
  }
  return context
}
