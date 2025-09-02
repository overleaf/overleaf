import { FC, useEffect, useRef, useState } from 'react'
import {
  CodeMirrorStateContext,
  CodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { EditorView } from '@codemirror/view'
import { EditorState, StateEffect } from '@codemirror/state'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { docName } from '@/features/source-editor/extensions/doc-name'
import {
  language,
  Metadata,
  setMetadata,
} from '@/features/source-editor/extensions/language'
import { showContentWhenParsed } from '@/features/source-editor/extensions/visual/visual'
import { usePhrases } from '@/features/source-editor/hooks/use-phrases'
import {
  setEditorTheme,
  theme,
} from '@/features/source-editor/extensions/theme'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import {
  visualHighlightStyle,
  visualTheme,
} from '@/features/source-editor/extensions/visual/visual-theme'
import { tableGeneratorTheme } from '@/features/source-editor/extensions/visual/table-generator'
import { atomicDecorations } from '@/features/source-editor/extensions/visual/atomic-decorations'
import { markDecorations } from '@/features/source-editor/extensions/visual/mark-decorations'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { isValidTeXFile } from '@/main/is-valid-tex-file'
import { mousedown } from '@/features/source-editor/extensions/visual/selection'

const visualPreviewTheme = EditorView.theme({
  '&.cm-editor': {
    background: '#fff',
  },
  '.ol-cm-preamble-wrapper, .ol-cm-end-document-widget': {
    visibility: 'hidden',
  },
})

export const VisualPreview: FC<{ view: EditorView }> = ({ view }) => {
  const [previewState, setPreviewState] = useState<EditorState>()

  const { fileTreeData } = useFileTreeData()
  const { previewByPath } = useFileTreePathContext()
  const { currentDocument, openDocName } = useEditorOpenDocContext()
  const phrases = usePhrases()

  const isMountedRef = useIsMounted()
  const viewRef = useRef<EditorView | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)
  const previewByPathRef = useRef(previewByPath)
  const metadataRef = useRef<Metadata>({
    labels: new Set(),
    packageNames: new Set(),
    referenceKeys: new Set(),
    searchLocalReferences() {
      return Promise.resolve({ hits: [] })
    },
    commands: [],
    fileTreeData,
  })

  useEffect(() => {
    if (!currentDocument) {
      return
    }

    const state = EditorState.create({
      doc: view.state.doc,
      extensions: [
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorState.phrases.of(phrases),
        docName('main.tex'),
        language('main.tex', metadataRef.current, { syntaxValidation: false }),
        theme({
          fontSize: 14,
          fontFamily: 'monaco',
          lineHeight: 'normal',
          activeOverallTheme: 'light',
        }),
        visualPreviewTheme,
        visualTheme,
        visualHighlightStyle,
        tableGeneratorTheme,
        mousedown,
        atomicDecorations({
          previewByPath: previewByPathRef.current,
        }),
        markDecorations, // NOTE: must be after atomicDecorations, so that mark decorations wrap inline widgets
        showContentWhenParsed,
        EditorView.contentAttributes.of({ 'aria-label': 'Visual preview' }),
      ],
    })

    const preview = new EditorView({
      state,
      dispatchTransactions(trs) {
        preview.update(trs)
        if (isMountedRef.current) {
          setPreviewState(preview.state)
        }
      },
      scrollTo: EditorView.scrollIntoView(state.selection.main, {
        y: 'center',
      }),
    })

    setEditorTheme('overleaf').then(spec => {
      preview.dispatch(spec)
    })

    containerRef.current?.replaceChildren(preview.dom)

    viewRef.current = preview

    view.dispatch({
      effects: StateEffect.appendConfig.of([
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            for (const tr of update.transactions) {
              preview.dispatch({
                changes: tr.changes,
              })
            }
          }

          if (update.selectionSet) {
            preview.dispatch({
              effects: EditorView.scrollIntoView(update.state.selection.main, {
                y: 'center',
              }),
            })
          }
        }),
      ]),
    })
  }, [phrases, view, currentDocument, isMountedRef])

  useEffect(() => {
    if (fileTreeData) {
      metadataRef.current.fileTreeData = fileTreeData
      window.setTimeout(() => {
        viewRef.current?.dispatch(setMetadata(metadataRef.current))
      })
    }
  }, [fileTreeData, view])

  useEffect(() => {
    return () => {
      viewRef.current?.destroy()
    }
  }, [view])

  if (!openDocName || !isValidTeXFile(openDocName)) {
    return null
  }

  return (
    <CodeMirrorStateContext.Provider value={previewState}>
      <CodeMirrorViewContext.Provider value={viewRef.current}>
        <div ref={containerRef} style={{ height: '100%' }} />
      </CodeMirrorViewContext.Provider>
    </CodeMirrorStateContext.Provider>
  )
}
