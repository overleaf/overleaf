import {
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
  DropdownHeader,
} from '@/shared/components/dropdown/dropdown-menu'
import type { Meta } from '@storybook/react'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import { IdeRedesign } from '../decorators/ide-redesign'

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

export const MultipleSelection = () => {
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

export const LeadingIcon = (args: Args) => {
  return (
    <DropdownMenu show>
      <OLDropdownMenuItem
        disabled={args.disabled}
        eventKey="1"
        href="#/action-1"
        leadingIcon="view_column_2"
      >
        Editor & PDF
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        active
        eventKey="2"
        href="#/action-2"
        leadingIcon="terminal"
      >
        Editor only
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        eventKey="3"
        href="#/action-3"
        leadingIcon="picture_as_pdf"
      >
        PDF only
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        eventKey="4"
        href="#/action-4"
        leadingIcon="select_window"
      >
        PDF in separate tab
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        eventKey="5"
        href="#/action-5"
        leadingIcon="align_space_even"
        description="Some description"
      >
        With a description
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        eventKey="6"
        href="#/action-6"
        leadingIcon="align_space_even"
        className="dropdown-item-material-icon-small"
      >
        Small icon
      </OLDropdownMenuItem>
    </DropdownMenu>
  )
}

export const TrailingIcon = () => {
  return (
    <DropdownMenu show>
      <OLDropdownMenuItem eventKey="1" href="#/action-1" trailingIcon="check">
        Tick
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        eventKey="2"
        href="#/action-2"
        trailingIcon="check"
        description="Some description"
      >
        With a description
      </OLDropdownMenuItem>
      <OLDropdownMenuItem
        eventKey="3"
        href="#/action-3"
        leadingIcon="align_space_even"
        trailingIcon="check"
        description="Some description"
      >
        With a leading icon
      </OLDropdownMenuItem>
    </DropdownMenu>
  )
}

const meta: Meta<typeof DropdownMenu> = {
  title: 'Shared / Components / DropdownMenu',
  component: DropdownMenu,
  args: {
    disabled: false,
  },
  parameters: {
    controls: {
      include: ['disabled'],
    },
  },
  decorators: [IdeRedesign],
}

export default meta
