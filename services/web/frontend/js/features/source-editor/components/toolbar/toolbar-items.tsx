import { ComponentType, FC, memo } from 'react'
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
import { InsertListDropdown } from './insert-list-dropdown'
import { TableDropdown } from './table-dropdown'
import { LegacyTableDropdown } from './table-inserter-dropdown-legacy'
import { withinFormattingCommand } from '@/features/source-editor/utils/tree-operations/formatting'
import { isMac } from '@/shared/utils/os'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { isCursorOnEmptyLine } from '@/features/source-editor/utils/is-cursor-on-empty-line'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

const sourceEditorToolbarButtonGroups = importOverleafModules(
  'sourceEditorToolbarButtonGroups'
) as {
  import: { default: ComponentType; overflowGroupId: string }
  path: string
}[]

const addCommentFromToolbar = () => commands.addComment('toolbar')

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
  const { showSymbolPalette, toggleSymbolPalette } =
    useEditorPropertiesContext()
  const { writefullInstance } = useEditorContext()
  const { features } = useProjectContext()
  const permissions = usePermissionsContext()
  const isActive = withinFormattingCommand(state)

  const symbolPaletteAvailable = getMeta('ol-symbolPaletteAvailable')
  const showAiFeaturesDisabled = getMeta('ol-showAiFeaturesDisabled')

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
            icon="undo"
            shortcut={isMac ? '⌘Z' : 'Ctrl+Z'}
          />
          <ToolbarButton
            id="toolbar-redo"
            label={t('toolbar_redo')}
            command={redo}
            icon="redo"
            shortcut={isMac ? '⇧⌘Z' : 'Ctrl+Y'}
          />
        </div>
      )}
      {sourceEditorToolbarButtonGroups.map(
        ({ import: { default: Component, overflowGroupId }, path }) =>
          showGroup(overflowGroupId) && <Component key={path} />
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
                label={t('toolbar_bold')}
                command={commands.toggleBold}
                active={isActive('\\textbf')}
                icon="format_bold"
                shortcut={isMac ? '⌘B' : 'Ctrl+B'}
              />
              <ToolbarButton
                id="toolbar-format-italic"
                label={t('toolbar_italic')}
                command={commands.toggleItalic}
                active={isActive('\\textit')}
                icon="format_italic"
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
                  label={t('toolbar_insert_symbol')}
                  active={showSymbolPalette}
                  command={toggleSymbolPalette}
                  icon="Ω"
                  textIcon
                  className="ol-cm-toolbar-button-math"
                />
              )}
            </div>
          )}
          <div
            className="ol-cm-toolbar-button-group"
            data-overflow="group-misc"
            aria-label={t('toolbar_insert_misc')}
          >
            {showGroup('misc-href') && (
              <div data-overflow="misc-href">
                <ToolbarButton
                  id="toolbar-href"
                  label={t('toolbar_insert_link')}
                  command={commands.wrapInHref}
                  icon="add_link"
                />
              </div>
            )}
            {features.trackChangesVisible &&
              permissions.comment &&
              showGroup('misc-comment') && (
                <div data-overflow="misc-comment">
                  <ToolbarButton
                    id="toolbar-add-comment"
                    label={t('add_comment')}
                    disabled={isCursorOnEmptyLine(state)}
                    command={addCommentFromToolbar}
                    icon="add_comment"
                  />
                </div>
              )}
            {showGroup('misc-ref') && (
              <div data-overflow="misc-ref">
                <ToolbarButton
                  id="toolbar-ref"
                  label={t('toolbar_insert_cross_reference')}
                  command={commands.insertRef}
                  icon="sell"
                />
              </div>
            )}
            {showGroup('misc-cite') && (
              <div data-overflow="misc-cite">
                <ToolbarButton
                  id="toolbar-cite"
                  label={t('toolbar_insert_citation')}
                  command={commands.insertCite}
                  icon="book_5"
                />
              </div>
            )}
            {showGroup('misc-figure') && (
              <div data-overflow="misc-figure">
                <InsertFigureDropdown />
              </div>
            )}
            {showGroup('misc-table') && (
              <div data-overflow="misc-table">
                {writefullInstance || showAiFeaturesDisabled ? (
                  <TableDropdown />
                ) : (
                  <LegacyTableDropdown />
                )}
              </div>
            )}
          </div>
          {showGroup('group-list') && (
            <div
              className="ol-cm-toolbar-button-group"
              data-overflow="group-list"
              aria-label={t('toolbar_list_indentation')}
            >
              <InsertListDropdown />
              {listDepth >= 1 && (
                <>
                  <ToolbarButton
                    id="toolbar-format-indent-decrease"
                    label={t('toolbar_decrease_indent')}
                    command={commands.indentDecrease}
                    icon="format_indent_decrease"
                    shortcut={visual ? (isMac ? '⌘[' : 'Ctrl+[') : undefined}
                    disabled={listDepth < 2}
                  />
                  <ToolbarButton
                    id="toolbar-format-indent-increase"
                    label={t('toolbar_increase_indent')}
                    command={commands.indentIncrease}
                    icon="format_indent_increase"
                    shortcut={visual ? (isMac ? '⌘]' : 'Ctrl+]') : undefined}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
})
