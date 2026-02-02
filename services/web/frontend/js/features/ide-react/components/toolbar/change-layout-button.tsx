import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import ChangeLayoutOptions from './change-layout-options'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

export default function ChangeLayoutButton() {
  const { t } = useTranslation()
  const toggleButtonClassName = classNames(
    'ide-redesign-toolbar-button-subdued',
    'ide-redesign-toolbar-dropdown-toggle-subdued',
    'ide-redesign-toolbar-button-icon'
  )

  return (
    <div className="ide-redesign-toolbar-button-container">
      <Dropdown className="toolbar-item layout-dropdown" align="end">
        <OLTooltip
          id="tooltip-open-layout-options"
          description={t('layout_options')}
          overlayProps={{ delay: 0, placement: 'bottom' }}
        >
          <span>
            <DropdownToggle
              id="layout-dropdown-btn"
              className={toggleButtonClassName}
              aria-label={t('layout_options')}
            >
              <MaterialIcon type="space_dashboard" unfilled />
            </DropdownToggle>
          </span>
        </OLTooltip>
        <DropdownMenu>
          <ChangeLayoutOptions />
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}
