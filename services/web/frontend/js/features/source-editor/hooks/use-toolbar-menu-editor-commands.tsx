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
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { language } from '@codemirror/language'
import { isCursorOnEmptyLine } from '@/features/source-editor/utils/is-cursor-on-empty-line'

export const useToolbarMenuBarEditorCommands = () => {
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { t } = useTranslation()
  const { view: layoutView } = useLayoutContext()
  const editorIsVisible = layoutView === 'editor'
  const { trackedWrite, comment } = usePermissionsContext()
  const languageName = state.facet(language)?.name
  const isTeXFile = languageName === 'latex'
  const canComment = !isCursorOnEmptyLine(state)

  const openFigureModal = useCallback((source: FigureModalSource) => {
    window.dispatchEvent(
      new CustomEvent('figure-modal:open', {
        detail: { source },
      })
    )
  }, [])

  const {
    hasLinkedProjectFileFeature,
    hasLinkedProjectOutputFileFeature,
    hasLinkUrlFeature,
  } = getMeta('ol-ExposedSettings')
  useCommandProvider(() => {
    if (!editorIsVisible) {
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
  }, [editorIsVisible, t, view, trackedWrite])

  // LaTeX commands
  useCommandProvider(() => {
    if (!editorIsVisible) {
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
        menuLabel: t('inline_math'),
        label: t('insert_inline_math'),
        handler: () => {
          commands.wrapInInlineMath(view)
          view.focus()
        },
      },
      {
        id: 'insert-display-math',
        menuLabel: t('display_math'),
        label: t('insert_display_math'),
        handler: () => {
          commands.wrapInDisplayMath(view)
          view.focus()
        },
      },
      {
        menuLabel: t('upload_from_computer'),
        label: t('insert_figure_from_computer'),
        id: 'insert-figure-from-computer',
        handler: () => {
          openFigureModal(FigureModalSource.FILE_UPLOAD)
        },
      },
      {
        menuLabel: t('from_project_files'),
        label: t('insert_figure_from_project_files'),
        id: 'insert-figure-from-project-files',
        handler: () => {
          openFigureModal(FigureModalSource.FILE_TREE)
        },
      },
    ]
  }, [view, t, editorIsVisible, openFigureModal, trackedWrite, isTeXFile])

  useCommandProvider(() => {
    if (!editorIsVisible) {
      return
    }
    if (!isTeXFile || !trackedWrite) {
      return
    }
    if (!hasLinkedProjectFileFeature || !hasLinkedProjectOutputFileFeature) {
      return
    }
    return [
      {
        menuLabel: t('from_another_project'),
        label: t('insert_figure_from_another_project'),
        id: 'insert-figure-from-another-project',
        handler: () => {
          openFigureModal(FigureModalSource.OTHER_PROJECT)
        },
      },
    ]
  }, [
    t,
    editorIsVisible,
    openFigureModal,
    trackedWrite,
    isTeXFile,
    hasLinkedProjectFileFeature,
    hasLinkedProjectOutputFileFeature,
  ])

  useCommandProvider(() => {
    if (!editorIsVisible) {
      return
    }
    if (!isTeXFile || !trackedWrite) {
      return
    }
    if (!hasLinkUrlFeature) {
      return
    }
    return [
      {
        menuLabel: t('from_url'),
        label: t('insert_figure_from_url'),
        id: 'insert-figure-from-url',
        handler: () => {
          openFigureModal(FigureModalSource.FROM_URL)
        },
      },
    ]
  }, [
    t,
    editorIsVisible,
    openFigureModal,
    trackedWrite,
    isTeXFile,
    hasLinkUrlFeature,
  ])

  useCommandProvider(() => {
    if (!editorIsVisible) {
      return
    }
    if (!isTeXFile || !trackedWrite) {
      return
    }

    return [
      {
        id: 'insert-table',
        menuLabel: t('table'),
        label: t('insert_table'),
        handler: () => {
          commands.insertTable(view, 3, 3)
          view.focus()
        },
      },
      {
        id: 'insert-citation',
        menuLabel: t('citation'),
        label: t('insert_citation'),
        handler: () => {
          commands.insertCite(view)
          view.focus()
        },
      },
      {
        id: 'insert-link',
        menuLabel: t('link'),
        label: t('insert_link'),
        handler: () => {
          commands.wrapInHref(view)
          view.focus()
        },
      },
      {
        id: 'insert-cross-reference',
        menuLabel: t('cross_reference'),
        label: t('insert_cross_reference'),
        handler: () => {
          commands.insertRef(view)
          view.focus()
        },
      },
      {
        id: 'comment',
        menuLabel: t('comment'),
        label: t('add_comment'),
        handler: () => {
          commands.addComment('toolbar')
        },
        disabled: !comment || !canComment,
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
  }, [view, t, editorIsVisible, trackedWrite, isTeXFile, canComment, comment])

  const { toggleSymbolPalette } = useEditorPropertiesContext()
  const symbolPaletteAvailable = getMeta('ol-symbolPaletteAvailable')
  useCommandProvider(() => {
    if (!editorIsVisible) {
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
  ])
}
