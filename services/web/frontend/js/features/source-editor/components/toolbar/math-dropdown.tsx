import { ListGroupItem } from 'react-bootstrap'
import { ToolbarButtonMenu } from './button-menu'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import MaterialIcon from '../../../../shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import {
  wrapInDisplayMath,
  wrapInInlineMath,
} from '../../extensions/toolbar/commands'
import { memo } from 'react'

export const MathDropdown = memo(function MathDropdown() {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()

  return (
    <ToolbarButtonMenu
      id="toolbar-math"
      label={t('toolbar_insert_math')}
      icon="calculate"
      materialIcon
    >
      <ListGroupItem
        aria-label={t('toolbar_insert_inline_math')}
        onClick={event => {
          emitToolbarEvent(view, 'toolbar-inline-math')
          event.preventDefault()
          wrapInInlineMath(view)
          view.focus()
        }}
      >
        <MaterialIcon type="123" />
        <span>{t('toolbar_insert_inline_math')}</span>
      </ListGroupItem>
      <ListGroupItem
        aria-label={t('toolbar_insert_display_math')}
        onClick={event => {
          emitToolbarEvent(view, 'toolbar-display-math')
          event.preventDefault()
          wrapInDisplayMath(view)
          view.focus()
        }}
      >
        <MaterialIcon type="view_day" />
        <span>{t('toolbar_insert_display_math')}</span>
      </ListGroupItem>
    </ToolbarButtonMenu>
  )
})
