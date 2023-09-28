import { Dropdown, MenuItem } from 'react-bootstrap'
import ControlledDropdown from '../js/shared/components/controlled-dropdown'

export const Customized = args => {
  return (
    <ControlledDropdown
      pullRight={args.pullRight}
      defaultOpen={args.defaultOpen}
      id="dropdown-story"
    >
      <Dropdown.Toggle
        noCaret={args.noCaret}
        className={args.className}
        bsStyle={args.bsStyle}
      >
        {args.title}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <MenuItem eventKey="1">Action</MenuItem>
        <MenuItem eventKey="2">Another action</MenuItem>
        <MenuItem eventKey="3" active>
          Active Item
        </MenuItem>
        <MenuItem divider />
        <MenuItem eventKey="4">Separated link</MenuItem>
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}
Customized.args = {
  title: 'Toggle & Menu used separately',
}

export default {
  title: 'Shared / Components / Dropdown',
  component: ControlledDropdown,
  args: {
    bsStyle: 'default',
    title: 'Dropdown',
    pullRight: false,
    noCaret: false,
    className: '',
    defaultOpen: true,
  },
}
