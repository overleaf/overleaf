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
import { bsVersion } from '@/features/utils/bootstrap-5'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { isMac } from '@/shared/utils/os'

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
        <div
          className="ol-cm-toolbar-button-group"
          aria-label={t('toolbar_undo_redo_actions')}
        >
          <ToolbarButton
            id="toolbar-undo"
            label={t('toolbar_undo')}
            command={undo}
            icon={bsVersion({ bs5: 'undo', bs3: 'undo' })}
            shortcut={isMac ? '⌘Z' : 'Ctrl+Z'}
          />
          <ToolbarButton
            id="toolbar-redo"
            label={t('toolbar_redo')}
            command={redo}
            icon={bsVersion({ bs5: 'redo', bs3: 'repeat' })}
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
              aria-label={t('toolbar_text_formatting')}
            >
              <SectionHeadingDropdown />
            </div>
          )}
          {showGroup('group-format') && (
            <div
              className="ol-cm-toolbar-button-group"
              aria-label={t('toolbar_text_style')}
            >
              <ToolbarButton
                id="toolbar-format-bold"
                label={t('toolbar_format_bold')}
                command={commands.toggleBold}
                active={isActive('\\textbf')}
                icon={bsVersion({ bs5: 'format_bold', bs3: 'bold' })}
                shortcut={isMac ? '⌘B' : 'Ctrl+B'}
              />
              <ToolbarButton
                id="toolbar-format-italic"
                label={t('toolbar_format_italic')}
                command={commands.toggleItalic}
                active={isActive('\\textit')}
                icon={bsVersion({ bs5: 'format_italic', bs3: 'italic' })}
                shortcut={isMac ? '⌘I' : 'Ctrl+I'}
              />
            </div>
          )}
          {showGroup('group-math') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-math"
              aria-label={t('toolbar_insert_math_and_symbols')}
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
              aria-label={t('toolbar_insert_misc')}
            >
              <ToolbarButton
                id="toolbar-href"
                label={t('toolbar_insert_link')}
                command={commands.wrapInHref}
                icon={bsVersion({ bs5: 'add_link', bs3: 'link' })}
              />
              {isSplitTestEnabled('review-panel-redesign') && (
                <ToolbarButton
                  id="toolbar-add-comment"
                  label={t('add_comment')}
                  disabled={state.selection.main.empty}
                  command={commands.addComment}
                  icon={bsVersion({ bs5: 'add_comment', bs3: 'comment' })}
                />
              )}
              <ToolbarButton
                id="toolbar-ref"
                label={t('toolbar_insert_cross_reference')}
                command={commands.insertRef}
                icon={bsVersion({ bs5: 'sell', bs3: 'tag' })}
              />
              <ToolbarButton
                id="toolbar-cite"
                label={t('toolbar_insert_citation')}
                command={commands.insertCite}
                icon={bsVersion({ bs5: 'book_5', bs3: 'book' })}
              />
              <InsertFigureDropdown />
              <TableInserterDropdown />
            </div>
          )}
          {showGroup('group-list') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-list"
              aria-label={t('toolbar_list_indentation')}
            >
              <ToolbarButton
                id="toolbar-bullet-list"
                label={t('toolbar_bullet_list')}
                command={commands.toggleBulletList}
                icon={bsVersion({
                  bs5: 'format_list_bulleted',
                  bs3: 'list-ul',
                })}
              />
              <ToolbarButton
                id="toolbar-numbered-list"
                label={t('toolbar_numbered_list')}
                command={commands.toggleNumberedList}
                icon={bsVersion({
                  bs5: 'format_list_numbered',
                  bs3: 'list-ol',
                })}
              />
              <ToolbarButton
                id="toolbar-format-indent-decrease"
                label={t('toolbar_decrease_indent')}
                command={commands.indentDecrease}
                icon={bsVersion({
                  bs5: 'format_indent_decrease',
                  bs3: 'outdent',
                })}
                shortcut={visual ? (isMac ? '⌘[' : 'Ctrl+[') : undefined}
                disabled={listDepth < 2}
              />
              <ToolbarButton
                id="toolbar-format-indent-increase"
                label={t('toolbar_increase_indent')}
                command={commands.indentIncrease}
                icon={bsVersion({
                  bs5: 'format_indent_increase',
                  bs3: 'indent',
                })}
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
