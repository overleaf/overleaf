import { memo } from 'react'
import { Dropdown } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import ControlledDropdown from '../../../../../../shared/components/controlled-dropdown'
import CopyProjectMenuItem from '../menu-items/copy-project-menu-item'
import RenameProjectMenuItem from '../menu-items/rename-project-menu-item'

function ProjectToolsMoreDropdownButton() {
  const { t } = useTranslation()
  return (
    <ControlledDropdown id="project-tools-more-dropdown">
      <Dropdown.Toggle bsStyle={null} className="btn-secondary">
        {t('more')}
      </Dropdown.Toggle>
      <Dropdown.Menu className="dropdown-menu-right">
        <RenameProjectMenuItem />
        <CopyProjectMenuItem />
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}

export default memo(ProjectToolsMoreDropdownButton)
