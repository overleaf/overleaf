import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import CopyProjectMenuItem from '../menu-items/copy-project-menu-item'
import RenameProjectMenuItem from '../menu-items/rename-project-menu-item'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'

function ProjectToolsMoreDropdownButton() {
  const { t } = useTranslation()

  return (
    <OLDropdown align="end">
      <OLDropdownToggle id="project-tools-more-dropdown" variant="secondary">
        {t('more')}
      </OLDropdownToggle>
      <OLDropdownMenu
        flip={false}
        data-testid="project-tools-more-dropdown-menu"
      >
        <RenameProjectMenuItem />
        <CopyProjectMenuItem />
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default memo(ProjectToolsMoreDropdownButton)
