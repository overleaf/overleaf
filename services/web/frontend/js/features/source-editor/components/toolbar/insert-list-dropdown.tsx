import { ToolbarButtonMenu } from './button-menu'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import MaterialIcon from '../../../../shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorViewContext } from '../codemirror-context'
import {
  toggleBulletList,
  toggleNumberedList,
} from '../../extensions/toolbar/commands'
import { memo } from 'react'
import OLListGroupItem from '@/shared/components/ol/ol-list-group-item'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

export const InsertListDropdown = memo(function InsertListDropdown() {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()

  return (
    <ToolbarButtonMenu
      id="toolbar-insert-list"
      label={t('toolbar_insert_list')}
      icon={<MaterialIcon type="format_list_bulleted" />}
      orientation="horizontal"
    >
      <OLTooltip
        id="toolbar-bullet-list"
        description={t('toolbar_bulleted_list')}
        overlayProps={{ placement: 'bottom' }}
      >
        <OLListGroupItem
          aria-label={t('toolbar_bulleted_list')}
          onClick={event => {
            emitToolbarEvent(view, 'toolbar-bullet-list')
            event.preventDefault()
            toggleBulletList(view)
            view.focus()
          }}
        >
          <MaterialIcon type="format_list_bulleted" />
        </OLListGroupItem>
      </OLTooltip>
      <OLTooltip
        id="toolbar-numbered-list"
        description={t('toolbar_numbered_list')}
        overlayProps={{ placement: 'bottom' }}
      >
        <OLListGroupItem
          aria-label={t('toolbar_numbered_list')}
          onClick={event => {
            emitToolbarEvent(view, 'toolbar-numbered-list')
            event.preventDefault()
            toggleNumberedList(view)
            view.focus()
          }}
        >
          <MaterialIcon type="format_list_numbered" />
        </OLListGroupItem>
      </OLTooltip>
    </ToolbarButtonMenu>
  )
})
