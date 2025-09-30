import { DropdownHeader } from '@/shared/components/dropdown/dropdown-menu'
import { ToolbarButtonMenu } from './button-menu'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import MaterialIcon from '../../../../shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { useEditorContext } from '@/shared/context/editor-context'
import {
  wrapInDisplayMath,
  wrapInInlineMath,
} from '../../extensions/toolbar/commands'
import { memo } from 'react'
import OLListGroupItem from '@/shared/components/ol/ol-list-group-item'
import sparkleWhite from '@/shared/svgs/sparkle-small-white.svg'
import sparkle from '@/shared/svgs/ai-sparkle-text.svg'

export const MathDropdown = memo(function MathDropdown() {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const { writefullInstance } = useEditorContext()

  return (
    <ToolbarButtonMenu
      id="toolbar-math"
      label={t('toolbar_insert_math')}
      icon={<MaterialIcon type="calculate" />}
    >
      {writefullInstance && (
        <>
          <DropdownHeader className="ol-cm-toolbar-header mx-2">
            {t('toolbar_insert_math_lowercase')}
          </DropdownHeader>
          <OLListGroupItem
            aria-label={t('toolbar_generate_math')}
            onClick={() => {
              writefullInstance?.openEquationGenerator()
            }}
          >
            <img
              alt="sparkle"
              className="ol-cm-toolbar-ai-sparkle-gradient"
              src={sparkle}
              aria-hidden="true"
            />
            <img
              alt="sparkle"
              className="ol-cm-toolbar-ai-sparkle-white"
              src={sparkleWhite}
              aria-hidden="true"
            />
            <span>{t('generate_from_text_or_image')}</span>
          </OLListGroupItem>
        </>
      )}
      <OLListGroupItem
        aria-label={t('toolbar_insert_inline_math')}
        onClick={event => {
          emitToolbarEvent(view, 'toolbar-inline-math')
          event.preventDefault()
          wrapInInlineMath(view)
          view.focus()
        }}
      >
        <MaterialIcon type="123" />
        <span>{t('inline')}</span>
      </OLListGroupItem>
      <OLListGroupItem
        aria-label={t('toolbar_insert_display_math')}
        onClick={event => {
          emitToolbarEvent(view, 'toolbar-display-math')
          event.preventDefault()
          wrapInDisplayMath(view)
          view.focus()
        }}
      >
        <MaterialIcon type="view_day" />
        <span>{t('display')}</span>
      </OLListGroupItem>
    </ToolbarButtonMenu>
  )
})
