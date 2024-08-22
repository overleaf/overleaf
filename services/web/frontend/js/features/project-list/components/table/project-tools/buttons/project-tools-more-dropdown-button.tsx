import { memo } from 'react'
import { Dropdown as BS3Dropdown } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import ControlledDropdown from '../../../../../../shared/components/controlled-dropdown'
import CopyProjectMenuItem from '../menu-items/copy-project-menu-item'
import RenameProjectMenuItem from '../menu-items/rename-project-menu-item'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function ProjectToolsMoreDropdownButton() {
  const { t } = useTranslation()

  return (
    <BootstrapVersionSwitcher
      bs3={
        <ControlledDropdown id="project-tools-more-dropdown">
          <BS3Dropdown.Toggle bsStyle={null} className="btn-secondary">
            {t('more')}
          </BS3Dropdown.Toggle>
          <BS3Dropdown.Menu
            className="dropdown-menu-right"
            data-testid="project-tools-more-dropdown-menu"
          >
            <RenameProjectMenuItem />
            <CopyProjectMenuItem />
          </BS3Dropdown.Menu>
        </ControlledDropdown>
      }
      bs5={
        <Dropdown align="end">
          <DropdownToggle id="project-tools-more-dropdown" variant="secondary">
            {t('more')}
          </DropdownToggle>
          <DropdownMenu
            flip={false}
            data-testid="project-tools-more-dropdown-menu"
          >
            <li role="none">
              <RenameProjectMenuItem />
            </li>
            <li role="none">
              <CopyProjectMenuItem />
            </li>
          </DropdownMenu>
        </Dropdown>
      }
    />
  )
}

export default memo(ProjectToolsMoreDropdownButton)
