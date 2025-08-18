import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import CopyProjectMenuItem from '../menu-items/copy-project-menu-item'
import RenameProjectMenuItem from '../menu-items/rename-project-menu-item'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'

function ProjectToolsMoreDropdownButton() {
  const { t } = useTranslation()

  return (
    <Dropdown align="end">
      <DropdownToggle id="project-tools-more-dropdown" variant="secondary">
        {t('more')}
      </DropdownToggle>
      <DropdownMenu flip={false} data-testid="project-tools-more-dropdown-menu">
        <RenameProjectMenuItem />
        <CopyProjectMenuItem />
      </DropdownMenu>
    </Dropdown>
  )
}

export default memo(ProjectToolsMoreDropdownButton)
