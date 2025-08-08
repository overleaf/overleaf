import { DropdownHeader } from '@/shared/components/dropdown/dropdown-menu'
import { ToolbarButtonMenu } from './button-menu'
import MaterialIcon from '../../../../shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useEditorContext } from '@/shared/context/editor-context'
import { memo, useRef, useCallback } from 'react'
import OLListGroupItem from '@/shared/components/ol/ol-list-group-item'
import sparkleWhite from '@/shared/svgs/sparkle-small-white.svg'
import sparkle from '@/shared/svgs/ai-sparkle-text.svg'
import { TableInserterDropdown } from './table-inserter-dropdown'
import OLOverlay from '@/shared/components/ol/ol-overlay'
import OLPopover from '@/shared/components/ol/ol-popover'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import * as commands from '../../extensions/toolbar/commands'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'

export const TableDropdown = memo(function TableDropdown() {
  const { t } = useTranslation()
  const { writefullInstance } = useEditorContext()
  const selectSizeDropdown = useDropdown()
  const target = useRef<any>(null)
  const view = useCodeMirrorViewContext()

  const onSizeSelected = useCallback(
    (sizeX: number, sizeY: number) => {
      selectSizeDropdown.onToggle(false)
      commands.insertTable(view, sizeX, sizeY)
      emitToolbarEvent(view, 'table-generator-insert-table')
      view.focus()
    },
    [selectSizeDropdown, view]
  )

  return (
    <>
      <div ref={target}>
        <ToolbarButtonMenu
          id="toolbar-table"
          label={t('toolbar_insert_table')}
          disablePopover={selectSizeDropdown.open}
          icon={<MaterialIcon type="table_chart" />}
        >
          <DropdownHeader className="ol-cm-toolbar-header mx-2">
            {t('toolbar_table_insert_table_lowercase')}
          </DropdownHeader>
          <OLListGroupItem
            aria-label={t('toolbar_generate_table')}
            onClick={() => {
              writefullInstance?.openTableGenerator()
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
          <div className="ol-cm-toolbar-dropdown-divider mx-2 my-0" />
          <OLListGroupItem
            aria-label={t('toolbar_insert_table')}
            onMouseDown={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={event => {
              selectSizeDropdown.onToggle(!selectSizeDropdown.open)
              // prevent click event from bubbling up to the toolbar overflow button causing it to close
              event.stopPropagation()
            }}
          >
            <span>{t('select_size')}</span>
          </OLListGroupItem>
        </ToolbarButtonMenu>
        <OLOverlay
          show={selectSizeDropdown.open}
          target={target.current}
          placement="bottom"
          container={view.dom}
          containerPadding={0}
          transition
          rootClose
          onHide={() => selectSizeDropdown.onToggle(false)}
        >
          <OLPopover
            id="toolbar-table-menu"
            ref={selectSizeDropdown.ref}
            className="ol-cm-toolbar-button-menu-popover ol-cm-toolbar-button-menu-popover-unstyled"
          >
            <TableInserterDropdown onSizeSelected={onSizeSelected} />
          </OLPopover>
        </OLOverlay>
      </div>
    </>
  )
})
