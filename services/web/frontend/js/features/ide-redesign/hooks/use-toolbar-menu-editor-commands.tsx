import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { FigureModalSource } from '@/features/source-editor/components/figure-modal/figure-modal-context'
import * as commands from '@/features/source-editor/extensions/toolbar/commands'
import { setSectionHeadingLevel } from '@/features/source-editor/extensions/toolbar/sections'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import getMeta from '@/utils/meta'
import { redo, selectAll, undo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsNewEditorEnabled } from '../utils/new-editor-utils'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { language } from '@codemirror/language'

export const useToolbarMenuBarEditorCommands = () => {
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { t } = useTranslation()
  const { view: layoutView } = useLayoutContext()
  const editorIsVisible = layoutView === 'editor'
  const { trackedWrite, comment } = usePermissionsContext()
  const languageName = state.facet(language)?.name
  const isTeXFile = languageName === 'latex'

  const openFigureModal = useCallback((source: FigureModalSource) => {
    window.dispatchEvent(
      new CustomEvent('figure-modal:open', {
        detail: { source },
      })
    )
  }, [])

  const newEditor = useIsNewEditorEnabled()

  useCommandProvider(() => {
    if (!newEditor || !editorIsVisible) {
      return
    }

    return [
      /************************************
       *          Edit menu
       ************************************/
      {
        id: 'undo',
        label: t('undo'),
        handler: () => {
          undo(view)
          view.focus()
        },
        disabled: !trackedWrite,
      },
      {
        id: 'redo',
        label: t('redo'),
        handler: () => {
          redo(view)
          view.focus()
        },
        disabled: !trackedWrite,
      },
      {
        id: 'find',
        label: t('find'),
        handler: () => {
          openSearchPanel(view)
        },
      },
      {
        id: 'select-all',
        label: t('select_all'),
        handler: () => {
          selectAll(view)
          view.focus()
        },
      },
    ]
  }, [editorIsVisible, t, view, trackedWrite, newEditor])

  // LaTeX commands
  useCommandProvider(() => {
    if (!newEditor || !editorIsVisible) {
      return
    }
    if (!isTeXFile || !trackedWrite) {
      return
    }

    return [
      /************************************
       *         Insert menu
       ************************************/
      {
        id: 'insert-inline-math',
        label: t('inline_math'),
        handler: () => {
          commands.wrapInInlineMath(view)
          view.focus()
        },
      },
      {
        id: 'insert-display-math',
        label: t('display_math'),
        handler: () => {
          commands.wrapInDisplayMath(view)
          view.focus()
        },
      },
      {
        label: t('upload_from_computer'),
        id: 'insert-figure-from-computer',
        handler: () => {
          openFigureModal(FigureModalSource.FILE_UPLOAD)
        },
      },
      {
        label: t('from_project_files'),
        id: 'insert-figure-from-project-files',
        handler: () => {
          openFigureModal(FigureModalSource.FILE_TREE)
        },
      },
      {
        label: t('from_another_project'),
        id: 'insert-figure-from-another-project',
        handler: () => {
          openFigureModal(FigureModalSource.OTHER_PROJECT)
        },
      },
      {
        label: t('from_url'),
        id: 'insert-figure-from-url',
        handler: () => {
          openFigureModal(FigureModalSource.FROM_URL)
        },
      },
      {
        id: 'insert-table',
        label: t('table'),
        handler: () => {
          commands.insertTable(view, 3, 3)
          view.focus()
        },
      },
      {
        id: 'insert-citation',
        label: t('citation'),
        handler: () => {
          commands.insertCite(view)
          view.focus()
        },
      },
      {
        id: 'insert-link',
        label: t('link'),
        handler: () => {
          commands.wrapInHref(view)
          view.focus()
        },
      },
      {
        id: 'insert-cross-reference',
        label: t('cross_reference'),
        handler: () => {
          commands.insertRef(view)
          view.focus()
        },
      },
      {
        id: 'comment',
        label: t('comment'),
        handler: () => {
          commands.addComment()
        },
        disabled: !comment || state.selection.main.empty,
      },
      /************************************
       *         Format menu
       ************************************/
      {
        id: 'format-bold',
        label: t('bold'),
        handler: () => {
          commands.toggleBold(view)
          view.focus()
        },
      },
      {
        id: 'format-italics',
        label: t('italics'),
        handler: () => {
          commands.toggleItalic(view)
          view.focus()
        },
      },
      {
        id: 'format-bullet-list',
        label: t('bullet_list'),
        handler: () => {
          commands.toggleBulletList(view)
          view.focus()
        },
      },
      {
        id: 'format-numbered-list',
        label: t('numbered_list'),
        handler: () => {
          commands.toggleNumberedList(view)
          view.focus()
        },
      },
      {
        id: 'format-increase-indentation',
        label: t('increase_indent'),
        handler: () => {
          commands.indentIncrease(view)
          view.focus()
        },
      },
      {
        id: 'format-decrease-indentation',
        label: t('decrease_indent'),
        handler: () => {
          commands.indentDecrease(view)
          view.focus()
        },
      },
      {
        id: 'format-style-normal',
        label: t('normal'),
        handler: () => {
          setSectionHeadingLevel(view, 'text')
          view.focus()
        },
      },
      {
        id: 'format-style-section',
        label: 'Section',
        handler: () => {
          setSectionHeadingLevel(view, 'section')
          view.focus()
        },
      },
      {
        id: 'format-style-subsection',
        label: 'Subsection',
        handler: () => {
          setSectionHeadingLevel(view, 'subsection')
          view.focus()
        },
      },
      {
        id: 'format-style-subsubsection',
        label: 'Subsubsection',
        handler: () => {
          setSectionHeadingLevel(view, 'subsubsection')
          view.focus()
        },
      },
      {
        id: 'format-style-paragraph',
        label: 'Paragraph',
        handler: () => {
          setSectionHeadingLevel(view, 'paragraph')
          view.focus()
        },
      },
      {
        id: 'format-style-subparagraph',
        label: 'Subparagraph',
        handler: () => {
          setSectionHeadingLevel(view, 'subparagraph')
          view.focus()
        },
      },
    ]
  }, [
    view,
    t,
    editorIsVisible,
    openFigureModal,
    newEditor,
    trackedWrite,
    isTeXFile,
    state.selection.main.empty,
    comment,
  ])

  const { toggleSymbolPalette } = useEditorPropertiesContext()
  const symbolPaletteAvailable = getMeta('ol-symbolPaletteAvailable')
  useCommandProvider(() => {
    if (!newEditor || !editorIsVisible) {
      return
    }

    if (!symbolPaletteAvailable) {
      return
    }

    if (!isTeXFile || !trackedWrite) {
      return
    }

    return [
      {
        id: 'insert-symbol',
        label: t('symbol'),
        handler: () => {
          toggleSymbolPalette?.()
        },
      },
    ]
  }, [
    symbolPaletteAvailable,
    t,
    toggleSymbolPalette,
    editorIsVisible,
    isTeXFile,
    trackedWrite,
    newEditor,
  ])
}
