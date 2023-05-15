import { FC, memo, useCallback } from 'react'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEditorContext } from '../../../../shared/context/editor-context'
import useScopeEventEmitter from '../../../../shared/hooks/use-scope-event-emitter'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import {
  minimumListDepthForSelection,
  withinFormattingCommand,
} from '../../utils/tree-operations/ancestors'
import { ToolbarButton } from './toolbar-button'
import { redo, undo } from '@codemirror/commands'
import * as commands from '../../extensions/toolbar/commands'
import { SectionHeadingDropdown } from './section-heading-dropdown'
import { canAddComment } from '../../extensions/toolbar/comments'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { InsertFigureDropdown } from './insert-figure-dropdown'

const isMac = /Mac/.test(window.navigator?.platform)

export const ToolbarItems: FC<{
  state: EditorState
  overflowed?: Set<string>
}> = memo(function ToolbarItems({ state, overflowed }) {
  const { t } = useTranslation()
  const { toggleSymbolPalette, showSymbolPalette } = useEditorContext()
  const isActive = withinFormattingCommand(state)
  const listDepth = minimumListDepthForSelection(state)
  const addCommentEmitter = useScopeEventEmitter('comment:start_adding')
  const { setReviewPanelOpen } = useLayoutContext()
  const splitTestVariants = getMeta('ol-splitTestVariants', {})
  const addComment = useCallback(
    (view: EditorView) => {
      const range = view.state.selection.main
      if (range.empty) {
        const line = view.state.doc.lineAt(range.head)
        view.dispatch({
          selection: EditorSelection.range(line.from, line.to),
        })
      }
      setReviewPanelOpen(true)
      addCommentEmitter()
    },
    [addCommentEmitter, setReviewPanelOpen]
  )

  const showFigureModal = splitTestVariants['figure-modal'] === 'enabled'
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
        <div className="ol-cm-toolbar-button-group" data-overflow="group-math">
          <ToolbarButton
            id="toolbar-inline-math"
            label={t('toolbar_insert_inline_math')}
            command={commands.wrapInInlineMath}
            icon="π"
            textIcon
            className="ol-cm-toolbar-button-math"
          />
          <ToolbarButton
            id="toolbar-display-math"
            label={t('toolbar_insert_display_math')}
            command={commands.wrapInDisplayMath}
            icon="Σ"
            textIcon
            className="ol-cm-toolbar-button-math"
          />
          <ToolbarButton
            id="toolbar-toggle-symbol-palette"
            label={t('toolbar_toggle_symbol_palette')}
            active={showSymbolPalette}
            command={toggleSymbolPalette}
            icon="Ω"
            textIcon
            className="ol-cm-toolbar-button-math"
          />
        </div>
      )}
      {showGroup('group-misc') && (
        <div className="ol-cm-toolbar-button-group" data-overflow="group-misc">
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
          <ToolbarButton
            id="toolbar-add-comment"
            label={t('toolbar_add_comment')}
            command={addComment}
            disabled={!canAddComment(state)}
            icon="comment"
            hidden // enable this if an alternative to the floating "Add Comment" button is needed
          />
          {showFigureModal ? (
            <InsertFigureDropdown />
          ) : (
            <ToolbarButton
              id="toolbar-figure"
              label={t('toolbar_insert_figure')}
              command={commands.insertFigure}
              icon="picture-o"
            />
          )}
          <ToolbarButton
            id="toolbar-table"
            label={t('toolbar_insert_table')}
            command={commands.insertTable}
            icon="table"
            hidden
          />
        </div>
      )}
      {showGroup('group-list') && (
        <div className="ol-cm-toolbar-button-group" data-overflow="group-list">
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
            shortcut={isMac ? '⌘[' : 'Ctrl+['}
            disabled={listDepth < 2}
          />
          <ToolbarButton
            id="toolbar-format-indent-increase"
            label={t('toolbar_increase_indent')}
            command={commands.indentIncrease}
            icon="indent"
            shortcut={isMac ? '⌘]' : 'Ctrl+]'}
            disabled={listDepth < 1}
          />
        </div>
      )}
    </>
  )
})
