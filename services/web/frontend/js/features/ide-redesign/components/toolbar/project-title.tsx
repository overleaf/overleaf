import {
  Dropdown,
  DropdownDivider,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'

export const ToolbarProjectTitle = () => {
  const { name } = useProjectContext()
  const { t } = useTranslation()
  return (
    <Dropdown align="start">
      <DropdownToggle
        id="project-title-options"
        className="ide-redesign-toolbar-dropdown-toggle-subdued fw-bold"
        variant="secondary"
      >
        {name}
        <MaterialIcon
          type="keyboard_arrow_down"
          accessibilityLabel={t('project_title_options')}
        />
      </DropdownToggle>
      <DropdownMenu>
        <OLDropdownMenuItem>TODO: Export</OLDropdownMenuItem>
        <DropdownDivider />
        <OLDropdownMenuItem>{t('rename')}</OLDropdownMenuItem>
        <OLDropdownMenuItem>{t('download')}</OLDropdownMenuItem>
        <OLDropdownMenuItem className="text-danger">
          {t('delete')}
        </OLDropdownMenuItem>
      </DropdownMenu>
    </Dropdown>
  )
}
