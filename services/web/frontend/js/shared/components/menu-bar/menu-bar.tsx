import { MenuBarContext } from '@/shared/context/menu-bar-context'
import { FC, HTMLProps, useState } from 'react'

export const MenuBar: FC<HTMLProps<HTMLDivElement> & { id: string }> = ({
  children,
  id,
  ...props
}) => {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div {...props}>
      <MenuBarContext.Provider value={{ selected, setSelected, menuId: id }}>
        {children}
      </MenuBarContext.Provider>
    </div>
  )
}
