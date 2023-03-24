import { FC, useCallback, useRef, useState } from 'react'
import withErrorBoundary from '../../../../infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '../../../../shared/components/error-boundary-fallback'
import { EditorState, Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { lineNumbers } from '../../../../../../modules/source-editor/frontend/js/extensions/line-numbers'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'
import { highlights, setHighlightsEffect } from '../extensions/highlights'
import useScopeValue from '../../../../shared/hooks/use-scope-value'
import {
  FontFamily,
  LineHeight,
  OverallTheme,
} from '../../../../../../modules/source-editor/frontend/js/extensions/theme'
import { theme, Options } from '../extensions/theme'
import { indentUnit } from '@codemirror/language'

interface Range {
  from: number
  to: number
}

type HighlightType = 'addition' | 'deletion'

export interface Highlight {
  label: string
  hue: number
  range: Range
  type: HighlightType
}

function extensions(themeOptions: Options): Extension[] {
  return [
    EditorView.editable.of(false),
    lineNumbers(),
    EditorView.lineWrapping,
    indentUnit.of('    '),
    indentationMarkers({ hideFirstIndent: true, highlightActiveBlock: false }),
    highlights(),
    theme(themeOptions),
  ]
}

const DocumentDiffViewer: FC<{ doc: string; highlights: Highlight[] }> = ({
  doc,
  highlights,
}) => {
  const [fontFamily] = useScopeValue<FontFamily>('settings.fontFamily')
  const [fontSize] = useScopeValue<number>('settings.fontSize')
  const [lineHeight] = useScopeValue<LineHeight>('settings.lineHeight')
  const [overallTheme] = useScopeValue<OverallTheme>('settings.overallTheme')

  const [state] = useState(() => {
    return EditorState.create({
      doc,
      extensions: extensions({
        fontFamily,
        fontSize,
        lineHeight,
        overallTheme,
      }),
    })
  })

  const viewRef = useRef<EditorView | null>(null)
  if (viewRef.current === null) {
    viewRef.current = new EditorView({
      state,
    })
  }

  const view = viewRef.current

  // Append the editor view dom to the container node when mounted
  const containerRef = useCallback(
    node => {
      if (node) {
        node.appendChild(view.dom)
      }
    },
    [view]
  )

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
    effects: setHighlightsEffect.of(highlights),
  })

  return <div ref={containerRef} style={{ height: '100%' }} />
}

export default withErrorBoundary(DocumentDiffViewer, ErrorBoundaryFallback)
