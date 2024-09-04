import {
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
  DropdownHeader,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import type { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof DropdownMenu>

export const Default = (args: Args) => {
  return (
    <DropdownMenu show>
      <li>
        <DropdownItem eventKey="1" href="#/action-1">
          Example
        </DropdownItem>
      </li>
      <li>
        <DropdownItem eventKey="2" href="#/action-2">
          Example
        </DropdownItem>
      </li>
      <DropdownDivider />
      <li>
        <DropdownItem eventKey="3" disabled={args.disabled} href="#/action-3">
          Example
        </DropdownItem>
      </li>
    </DropdownMenu>
  )
}

export const Active = (args: Args) => {
  return (
    <DropdownMenu show>
      <li>
        <DropdownItem eventKey="1" href="#/action-1">
          Example
        </DropdownItem>
      </li>
      <li>
        <DropdownItem
          eventKey="2"
          active
          href="#/action-2"
          trailingIcon="check"
        >
          Example
        </DropdownItem>
      </li>
      <DropdownDivider />
      <li>
        <DropdownItem eventKey="3" disabled={args.disabled} href="#/action-3">
          Example
        </DropdownItem>
      </li>
    </DropdownMenu>
  )
}

export const MultipleSelection = (args: Args) => {
  return (
    <DropdownMenu show>
      <DropdownHeader>Header</DropdownHeader>
      <li>
        <DropdownItem
          eventKey="1"
          href="#/action-1"
          leadingIcon={<DropdownItem.EmptyLeadingIcon />}
        >
          Example
        </DropdownItem>
      </li>
      <li>
        <DropdownItem eventKey="2" href="#/action-2" leadingIcon="check">
          Example
        </DropdownItem>
      </li>
      <li>
        <DropdownItem eventKey="3" href="#/action-3" leadingIcon="check">
          Example
        </DropdownItem>
      </li>
    </DropdownMenu>
  )
}

export const Danger = (args: Args) => {
  return (
    <DropdownMenu show>
      <li>
        <DropdownItem eventKey="1" disabled={args.disabled} href="#/action-1">
          Example
        </DropdownItem>
      </li>
      <li>
        <DropdownItem eventKey="2" href="#/action-2">
          Example
        </DropdownItem>
      </li>
      <DropdownDivider />
      <li>
        <DropdownItem eventKey="3" href="#/action-3" variant="danger">
          Example
        </DropdownItem>
      </li>
    </DropdownMenu>
  )
}

export const Description = (args: Args) => {
  return (
    <DropdownMenu show>
      <li>
        <DropdownItem
          disabled={args.disabled}
          eventKey="1"
          href="#/action-1"
          description="Description of the menu"
        >
          Example
        </DropdownItem>
      </li>
      <li>
        <DropdownItem
          active
          eventKey="2"
          href="#/action-2"
          description="Description of the menu"
          trailingIcon="check"
        >
          Example
        </DropdownItem>
      </li>
    </DropdownMenu>
  )
}

export const Icon = (args: Args) => {
  return (
    <DropdownMenu show>
      <li>
        <DropdownItem
          disabled={args.disabled}
          eventKey="1"
          href="#/action-1"
          leadingIcon="view_column_2"
        >
          Editor & PDF
        </DropdownItem>
      </li>
      <li>
        <DropdownItem
          active
          eventKey="2"
          href="#/action-2"
          leadingIcon="terminal"
        >
          Editor only
        </DropdownItem>
      </li>
      <li>
        <DropdownItem
          eventKey="2"
          href="#/action-2"
          leadingIcon="picture_as_pdf"
        >
          PDF only
        </DropdownItem>
      </li>
      <li>
        <DropdownItem
          eventKey="2"
          href="#/action-2"
          leadingIcon="select_window"
        >
          PDF in separate tab
        </DropdownItem>
      </li>
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
