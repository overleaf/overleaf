import { DropdownDivider } from '@/shared/components/dropdown/dropdown-menu'
import { MenuBar } from '@/shared/components/menu-bar/menu-bar'
import { MenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'
import { MenuBarOption } from '@/shared/components/menu-bar/menu-bar-option'
import { Meta } from '@storybook/react/*'

export const Default = () => {
  return (
    <MenuBar id="toolbar-menu-bar-item">
      <MenuBarDropdown title="File" id="file">
        <MenuBarOption title="New File" />
        <MenuBarOption title="New project" />
      </MenuBarDropdown>
      <MenuBarDropdown title="Edit" id="edit">
        <MenuBarOption title="Undo" />
        <MenuBarOption title="Redo" />
        <DropdownDivider />
        <MenuBarOption title="Cut" />
        <MenuBarOption title="Copy" />
        <MenuBarOption title="Paste" />
      </MenuBarDropdown>
      <MenuBarDropdown title="View" id="view">
        <MenuBarOption title="PDF only" />
      </MenuBarDropdown>
    </MenuBar>
  )
}

const meta: Meta<typeof MenuBar> = {
  title: 'Shared / Components / MenuBar',
  component: MenuBar,
  argTypes: {},
}

export default meta
