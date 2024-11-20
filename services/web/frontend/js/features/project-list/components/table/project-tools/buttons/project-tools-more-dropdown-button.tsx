import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import CopyProjectMenuItem from '../menu-items/copy-project-menu-item'
import RenameProjectMenuItem from '../menu-items/rename-project-menu-item'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'

function ProjectToolsMoreDropdownButton() {
  const { t } = useTranslation()

  return (
    <Dropdown align="end">
      <DropdownToggle id="project-tools-more-dropdown" variant="secondary">
        {t('more')}
      </DropdownToggle>
      <DropdownMenu flip={false} data-testid="project-tools-more-dropdown-menu">
        <li role="none">
          <RenameProjectMenuItem />
        </li>
        <li role="none">
          <CopyProjectMenuItem />
        </li>
      </DropdownMenu>
    </Dropdown>
  )
}

export default memo(ProjectToolsMoreDropdownButton)
