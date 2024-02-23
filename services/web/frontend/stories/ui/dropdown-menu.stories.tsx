import {
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import type { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof DropdownMenu>

export const Default = (args: Args) => {
  return (
    <DropdownMenu show>
      <DropdownItem eventKey="1" href="#/action-1">
        Example
      </DropdownItem>
      <DropdownItem eventKey="2" href="#/action-2">
        Example
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem eventKey="3" disabled={args.disabled} href="#/action-3">
        Example
      </DropdownItem>
    </DropdownMenu>
  )
}

export const Active = (args: Args) => {
  return (
    <DropdownMenu show>
      <DropdownItem eventKey="1" href="#/action-1">
        Example
      </DropdownItem>
      <DropdownItem eventKey="2" active href="#/action-2" trailingIcon="check">
        Example
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem eventKey="3" disabled={args.disabled} href="#/action-3">
        Example
      </DropdownItem>
    </DropdownMenu>
  )
}

export const Danger = (args: Args) => {
  return (
    <DropdownMenu show>
      <DropdownItem eventKey="1" disabled={args.disabled} href="#/action-1">
        Example
      </DropdownItem>
      <DropdownItem eventKey="2" href="#/action-2">
        Example
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem eventKey="3" href="#/action-3" variant="danger">
        Example
      </DropdownItem>
    </DropdownMenu>
  )
}

export const Description = (args: Args) => {
  return (
    <DropdownMenu show>
      <DropdownItem
        disabled={args.disabled}
        eventKey="1"
        href="#/action-1"
        description="Description of the menu"
      >
        Example
      </DropdownItem>
      <DropdownItem
        active
        eventKey="2"
        href="#/action-2"
        description="Description of the menu"
        trailingIcon="check"
      >
        Example
      </DropdownItem>
    </DropdownMenu>
  )
}

export const Icon = (args: Args) => {
  return (
    <DropdownMenu show>
      <DropdownItem
        disabled={args.disabled}
        eventKey="1"
        href="#/action-1"
        leadingIcon="view_column_2"
      >
        Editor & PDF
      </DropdownItem>
      <DropdownItem
        active
        eventKey="2"
        href="#/action-2"
        leadingIcon="terminal"
      >
        Editor only
      </DropdownItem>
      <DropdownItem eventKey="2" href="#/action-2" leadingIcon="picture_as_pdf">
        PDF only
      </DropdownItem>
      <DropdownItem eventKey="2" href="#/action-2" leadingIcon="select_window">
        PDF in separate tab
      </DropdownItem>
    </DropdownMenu>
  )
}

const meta: Meta<typeof DropdownMenu> = {
  title: 'Shared / Components / Bootstrap 5 / DropdownMenu',
  component: DropdownMenu,
  argTypes: {
    disabled: {
      control: 'boolean',
    },
    show: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    bootstrap5: true,
  },
}

export default meta
