import React from 'react'
import { Dropdown, DropdownButton, MenuItem } from 'react-bootstrap'
import Icon from '../js/shared/components/icon'

const MenuItems = () => (
  <>
    <MenuItem eventKey="1">Action</MenuItem>
    <MenuItem eventKey="2">Another action</MenuItem>
    <MenuItem eventKey="3" active>
      Active Item
    </MenuItem>
    <MenuItem divider />
    <MenuItem eventKey="4">Separated link</MenuItem>
  </>
)

const defaultArgs = {
  bsStyle: 'default',
  title: 'Dropdown',
  pullRight: false,
  noCaret: false,
  className: '',
  defaultOpen: true
}

export const Default = args => {
  return (
    <DropdownButton {...args}>
      <MenuItems />
    </DropdownButton>
  )
}
Default.args = { ...defaultArgs }

export const Primary = args => {
  return (
    <DropdownButton {...args}>
      <MenuItems />
    </DropdownButton>
  )
}
Primary.args = { ...defaultArgs, bsStyle: 'primary' }

export const RightAligned = args => {
  return (
    <div style={{ 'text-align': 'right' }}>
      <DropdownButton {...args}>
        <MenuItems />
      </DropdownButton>
    </div>
  )
}
RightAligned.args = { ...defaultArgs, pullRight: true }

export const SingleIconTransparent = args => {
  return (
    <div style={{ 'text-align': 'right' }}>
      <DropdownButton {...args}>
        <MenuItems />
      </DropdownButton>
    </div>
  )
}
SingleIconTransparent.args = {
  ...defaultArgs,
  pullRight: true,
  title: <Icon type="ellipsis-v" />,
  noCaret: true,
  className: 'dropdown-toggle-no-background'
}

export const Customized = args => {
  return (
    <Dropdown pullRight={args.pullRight} defaultOpen={args.defaultOpen}>
      <Dropdown.Toggle
        noCaret={args.noCaret}
        className={args.className}
        bsStyle={args.bsStyle}
      >
        {args.title}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <MenuItems />
      </Dropdown.Menu>
    </Dropdown>
  )
}
Customized.args = {
  ...defaultArgs,
  component: Dropdown,
  title: 'Toggle & Menu used separately'
}

export default {
  title: 'Dropdown',
  component: DropdownButton
}
