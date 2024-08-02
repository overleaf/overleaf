import { FC, memo } from 'react'
import { EditorState } from '@codemirror/state'
import { useEditorContext } from '../../../../shared/context/editor-context'
import { ToolbarButton } from './toolbar-button'
import { redo, undo } from '@codemirror/commands'
import * as commands from '../../extensions/toolbar/commands'
import { SectionHeadingDropdown } from './section-heading-dropdown'
import getMeta from '../../../../utils/meta'
import { InsertFigureDropdown } from './insert-figure-dropdown'
import { useTranslation } from 'react-i18next'
import { MathDropdown } from './math-dropdown'
import { TableInserterDropdown } from './table-inserter-dropdown'
import { withinFormattingCommand } from '@/features/source-editor/utils/tree-operations/formatting'

const isMac = /Mac/.test(window.navigator?.platform)

export const ToolbarItems: FC<{
  state: EditorState
  overflowed?: Set<string>
  languageName?: string
  visual: boolean
  listDepth: number
}> = memo(function ToolbarItems({
  state,
  overflowed,
  languageName,
  visual,
  listDepth,
}) {
  const { t } = useTranslation()
  const { toggleSymbolPalette, showSymbolPalette } = useEditorContext()
  const isActive = withinFormattingCommand(state)

  const symbolPaletteAvailable = getMeta('ol-symbolPaletteAvailable')
  const showGroup = (group: string) => !overflowed || overflowed.has(group)

  return (
    <>
      {showGroup('group-history') && (
        <div className="ol-cm-toolbar-button-group">
          <ToolbarButton
            id="toolbar-undo"
            label={t('toolbar_undo')}
            command={undo}
            icon="undo"
            shortcut={isMac ? '⌘Z' : 'Ctrl+Z'}
          />
          <ToolbarButton
            id="toolbar-redo"
            label={t('toolbar_redo')}
            command={redo}
            icon="repeat"
            shortcut={isMac ? '⇧⌘Z' : 'Ctrl+Y'}
          />
        </div>
      )}
      {languageName === 'latex' && (
        <>
          {showGroup('group-section') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-section"
            >
              <SectionHeadingDropdown />
            </div>
          )}
          {showGroup('group-format') && (
            <div className="ol-cm-toolbar-button-group">
              <ToolbarButton
                id="toolbar-format-bold"
                label={t('toolbar_format_bold')}
                command={commands.toggleBold}
                active={isActive('\\textbf')}
                icon="bold"
                shortcut={isMac ? '⌘B' : 'Ctrl+B'}
              />
              <ToolbarButton
                id="toolbar-format-italic"
                label={t('toolbar_format_italic')}
                command={commands.toggleItalic}
                active={isActive('\\textit')}
                icon="italic"
                shortcut={isMac ? '⌘I' : 'Ctrl+I'}
              />
            </div>
          )}
          {showGroup('group-math') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-math"
            >
              <MathDropdown />
              {symbolPaletteAvailable && (
                <ToolbarButton
                  id="toolbar-toggle-symbol-palette"
                  label={t('toolbar_toggle_symbol_palette')}
                  active={showSymbolPalette}
                  command={toggleSymbolPalette}
                  icon="Ω"
                  textIcon
                  className="ol-cm-toolbar-button-math"
                />
              )}
            </div>
          )}
          {showGroup('group-misc') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-misc"
            >
              <ToolbarButton
                id="toolbar-href"
                label={t('toolbar_insert_link')}
                command={commands.wrapInHref}
                icon="link"
              />
              <ToolbarButton
                id="toolbar-ref"
                label={t('toolbar_insert_cross_reference')}
                command={commands.insertRef}
                icon="tag"
              />
              <ToolbarButton
                id="toolbar-cite"
                label={t('toolbar_insert_citation')}
                command={commands.insertCite}
                icon="book"
              />
              <InsertFigureDropdown />
              <TableInserterDropdown />
            </div>
          )}
          {showGroup('group-list') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-list"
            >
              <ToolbarButton
                id="toolbar-bullet-list"
                label={t('toolbar_bullet_list')}
                command={commands.toggleBulletList}
                icon="list-ul"
              />
              <ToolbarButton
                id="toolbar-numbered-list"
                label={t('toolbar_numbered_list')}
                command={commands.toggleNumberedList}
                icon="list-ol"
              />
              <ToolbarButton
                id="toolbar-format-indent-decrease"
                label={t('toolbar_decrease_indent')}
                command={commands.indentDecrease}
                icon="outdent"
                shortcut={visual ? (isMac ? '⌘[' : 'Ctrl+[') : undefined}
                disabled={listDepth < 2}
              />
              <ToolbarButton
                id="toolbar-format-indent-increase"
                label={t('toolbar_increase_indent')}
                command={commands.indentIncrease}
                icon="indent"
                shortcut={visual ? (isMac ? '⌘]' : 'Ctrl+]') : undefined}
                disabled={listDepth < 1}
              />
            </div>
          )}
        </>
      )}
    </>
  )
})
