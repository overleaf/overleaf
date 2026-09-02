import {
  OLDropdownMenu,
  OLDropdownItem,
  OLDropdownDivider,
  OLDropdownHeader,
} from '@/shared/components/ol/ol-dropdown-menu'
import type { Meta } from '@storybook/react-webpack5'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import { IdeRedesign } from '../decorators/ide-redesign'

type Args = React.ComponentProps<typeof OLDropdownMenu>

export const Default = (args: Args) => {
  return (
    <OLDropdownMenu show>
      <li>
        <OLDropdownItem eventKey="1" href="#/action-1">
          Example
        </OLDropdownItem>
      </li>
      <li>
        <OLDropdownItem eventKey="2" href="#/action-2">
          Example
        </OLDropdownItem>
      </li>
      <OLDropdownDivider />
      <li>
        <OLDropdownItem eventKey="3" disabled={args.disabled} href="#/action-3">
          Example
        </OLDropdownItem>
      </li>
    </OLDropdownMenu>
  )
}

export const Active = (args: Args) => {
  return (
    <OLDropdownMenu show>
      <li>
        <OLDropdownItem eventKey="1" href="#/action-1">
          Example
        </OLDropdownItem>
      </li>
      <li>
        <OLDropdownItem
          eventKey="2"
          active
          href="#/action-2"
          trailingIcon="check"
        >
          Example
        </OLDropdownItem>
      </li>
      <OLDropdownDivider />
      <li>
        <OLDropdownItem eventKey="3" disabled={args.disabled} href="#/action-3">
          Example
        </OLDropdownItem>
      </li>
    </OLDropdownMenu>
  )
}

export const MultipleSelection = () => {
  return (
    <OLDropdownMenu show>
      <OLDropdownHeader>Header</OLDropdownHeader>
      <li>
        <OLDropdownItem
          eventKey="1"
          href="#/action-1"
          leadingIcon={<OLDropdownItem.EmptyLeadingIcon />}
        >
          Example
        </OLDropdownItem>
      </li>
      <li>
        <OLDropdownItem eventKey="2" href="#/action-2" leadingIcon="check">
          Example
        </OLDropdownItem>
      </li>
      <li>
        <OLDropdownItem eventKey="3" href="#/action-3" leadingIcon="check">
          Example
        </OLDropdownItem>
      </li>
    </OLDropdownMenu>
  )
}

export const Danger = (args: Args) => {
  return (
    <OLDropdownMenu show>
      <li>
        <OLDropdownItem eventKey="1" disabled={args.disabled} href="#/action-1">
          Example
        </OLDropdownItem>
      </li>
      <li>
        <OLDropdownItem eventKey="2" href="#/action-2">
          Example
        </OLDropdownItem>
      </li>
      <OLDropdownDivider />
      <li>
        <OLDropdownItem eventKey="3" href="#/action-3" variant="danger">
          Example
        </OLDropdownItem>
      </li>
    </OLDropdownMenu>
  )
}

export const Description = (args: Args) => {
  return (
    <OLDropdownMenu show>
      <li>
        <OLDropdownItem
          disabled={args.disabled}
          eventKey="1"
          href="#/action-1"
          description="Description of the menu"
        >
          Example
        </OLDropdownItem>
      </li>
      <li>
        <OLDropdownItem
          active
          eventKey="2"
          href="#/action-2"
          description="Description of the menu"
          trailingIcon="check"
        >
          Example
        </OLDropdownItem>
      </li>
    </OLDropdownMenu>
  )
}

export const LeadingIcon = (args: Args) => {
  return (
    <OLDropdownMenu show>
      <DropdownMenuItem
        disabled={args.disabled}
        eventKey="1"
        href="#/action-1"
        leadingIcon="view_column_2"
      >
        Editor & PDF
      </DropdownMenuItem>
      <DropdownMenuItem
        active
        eventKey="2"
        href="#/action-2"
        leadingIcon="terminal"
      >
        Editor only
      </DropdownMenuItem>
      <DropdownMenuItem
        eventKey="3"
        href="#/action-3"
        leadingIcon="picture_as_pdf"
      >
        PDF only
      </DropdownMenuItem>
      <DropdownMenuItem
        eventKey="4"
        href="#/action-4"
        leadingIcon="select_window"
      >
        PDF in separate tab
      </DropdownMenuItem>
      <DropdownMenuItem
        eventKey="5"
        href="#/action-5"
        leadingIcon="align_space_even"
        description="Some description"
      >
        With a description
      </DropdownMenuItem>
      <DropdownMenuItem
        eventKey="6"
        href="#/action-6"
        leadingIcon="align_space_even"
        className="dropdown-item-material-icon-small"
      >
        Small icon
      </DropdownMenuItem>
    </OLDropdownMenu>
  )
}

export const TrailingIcon = () => {
  return (
    <OLDropdownMenu show>
      <DropdownMenuItem eventKey="1" href="#/action-1" trailingIcon="check">
        Tick
      </DropdownMenuItem>
      <DropdownMenuItem
        eventKey="2"
        href="#/action-2"
        trailingIcon="check"
        description="Some description"
      >
        With a description
      </DropdownMenuItem>
      <DropdownMenuItem
        eventKey="3"
        href="#/action-3"
        leadingIcon="align_space_even"
        trailingIcon="check"
        description="Some description"
      >
        With a leading icon
      </DropdownMenuItem>
    </OLDropdownMenu>
  )
}

const meta: Meta<typeof OLDropdownMenu> = {
  title: 'Shared / Components / OLDropdownMenu',
  component: OLDropdownMenu,
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
