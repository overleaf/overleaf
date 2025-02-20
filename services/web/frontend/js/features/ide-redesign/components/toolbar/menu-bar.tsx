import { DropdownDivider } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { MenuBar } from '@/shared/components/menu-bar/menu-bar'
import { MenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'
import { MenuBarOption } from '@/shared/components/menu-bar/menu-bar-option'
import { useTranslation } from 'react-i18next'
import ChangeLayoutOptions from './change-layout-options'

export const ToolbarMenuBar = () => {
  const { t } = useTranslation()
  return (
    <MenuBar
      className="ide-redesign-toolbar-menu-bar"
      id="toolbar-menu-bar-item"
    >
      <MenuBarDropdown
        title={t('file')}
        id="file"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        <MenuBarOption title="New File" />
        <MenuBarOption title="New Project" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('edit')}
        id="edit"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        <MenuBarOption title="Undo" />
        <MenuBarOption title="Redo" />
        <DropdownDivider />
        <MenuBarOption title="Cut" />
        <MenuBarOption title="Copy" />
        <MenuBarOption title="Pate" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('view')}
        id="view"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        <ChangeLayoutOptions />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('insert')}
        id="insert"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        <MenuBarOption title="Insert figure" />
        <MenuBarOption title="Insert table" />
        <MenuBarOption title="Insert link" />
        <MenuBarOption title="Add comment" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('format')}
        id="format"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        <MenuBarOption title="Bold text" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('help')}
        id="help"
        className="ide-redesign-toolbar-dropdown-toggle-subdued"
      >
        <MenuBarOption title="Keyboard shortcuts" />
        <MenuBarOption title="Documentation" />
        <DropdownDivider />
        <MenuBarOption title="Contact us" />
        <MenuBarOption title="Give feedback" />
      </MenuBarDropdown>
    </MenuBar>
  )
}
