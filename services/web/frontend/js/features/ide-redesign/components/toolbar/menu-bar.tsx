import {
  Dropdown,
  DropdownDivider,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

type MenuBarOptionProps = {
  title: string
  onClick?: () => void
}

type MenuBarDropdownProps = {
  title: string
  id: string
}

export const ToolbarMenuBar = () => {
  const { t } = useTranslation()
  return (
    <div className="ide-redesign-toolbar-menu-bar">
      <MenuBarDropdown title={t('file')} id="file">
        <MenuBarOption title="New File" />
        <MenuBarOption title="New Project" />
      </MenuBarDropdown>
      <MenuBarDropdown title={t('edit')} id="edit">
        <MenuBarOption title="Undo" />
        <MenuBarOption title="Redo" />
        <DropdownDivider />
        <MenuBarOption title="Cut" />
        <MenuBarOption title="Copy" />
        <MenuBarOption title="Pate" />
      </MenuBarDropdown>
      <MenuBarDropdown title={t('view')} id="view">
        <MenuBarOption title="PDF only" />
      </MenuBarDropdown>
      <MenuBarDropdown title={t('insert')} id="insert">
        <MenuBarOption title="Insert figure" />
        <MenuBarOption title="Insert table" />
        <MenuBarOption title="Insert link" />
        <MenuBarOption title="Add comment" />
      </MenuBarDropdown>
      <MenuBarDropdown title={t('format')} id="format">
        <MenuBarOption title="Bold text" />
      </MenuBarDropdown>
      <MenuBarDropdown title={t('help')} id="help">
        <MenuBarOption title="Keyboard shortcuts" />
        <MenuBarOption title="Documentation" />
        <DropdownDivider />
        <MenuBarOption title="Contact us" />
        <MenuBarOption title="Give feedback" />
      </MenuBarDropdown>
    </div>
  )
}

const MenuBarDropdown: FC<MenuBarDropdownProps> = ({ title, children, id }) => {
  return (
    <Dropdown align="start">
      <DropdownToggle
        id={`toolbar-menu-bar-item-${id}`}
        variant="secondary"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        {title}
      </DropdownToggle>
      <DropdownMenu>{children}</DropdownMenu>
    </Dropdown>
  )
}

const MenuBarOption = ({ title, onClick }: MenuBarOptionProps) => {
  return <OLDropdownMenuItem onClick={onClick}>{title}</OLDropdownMenuItem>
}
