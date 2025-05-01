import { NestableDropdownContextProvider } from '@/shared/context/nestable-dropdown-context'
import { FC, HTMLProps } from 'react'

export const MenuBar: FC<
  React.PropsWithChildren<HTMLProps<HTMLDivElement> & { id: string }>
> = ({ children, id, ...props }) => {
  return (
    <div {...props}>
      <NestableDropdownContextProvider id={id}>
        {children}
      </NestableDropdownContextProvider>
    </div>
  )
}
