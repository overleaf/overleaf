import { useCallback, useEffect, useState } from 'react'
import withErrorBoundary from '../../../../infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '../../../../shared/components/error-boundary-fallback'
import {
  EditorSelection,
  EditorState,
  Extension,
  StateEffect,
} from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'
import { highlights, setHighlightsEffect } from '../../extensions/highlights'
import useScopeValue from '../../../../shared/hooks/use-scope-value'
import { theme, Options } from '../../extensions/theme'
import { indentUnit } from '@codemirror/language'
import { Highlight } from '../../services/types/doc'
import useIsMounted from '../../../../shared/hooks/use-is-mounted'
import {
  highlightLocations,
  highlightLocationsField,
  scrollToHighlight,
} from '../../extensions/highlight-locations'
import Icon from '../../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { inlineBackground } from '../../../source-editor/extensions/inline-background'

type FontFamily = 'monaco' | 'lucida'
type LineHeight = 'compact' | 'normal' | 'wide'
type OverallTheme = '' | 'light-'

function extensions(themeOptions: Options): Extension[] {
  return [
    EditorView.editable.of(false),
    lineNumbers(),
    EditorView.lineWrapping,
    indentUnit.of('    '), // TODO: Vary this by file type
    indentationMarkers({ hideFirstIndent: true, highlightActiveBlock: false }),
    highlights(),
    highlightLocations(),
    theme(themeOptions),
    inlineBackground(false),
  ]
}

function DocumentDiffViewer({
  doc,
  highlights,
}: {
  doc: string
  highlights: Highlight[]
}) {
  const [fontFamily] = useScopeValue<FontFamily>('settings.fontFamily')
  const [fontSize] = useScopeValue<number>('settings.fontSize')
  const [lineHeight] = useScopeValue<LineHeight>('settings.lineHeight')
  const [overallTheme] = useScopeValue<OverallTheme>('settings.overallTheme')
  const isMounted = useIsMounted()
  const { t } = useTranslation()

  const [state, setState] = useState(() => {
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

  const [view] = useState<EditorView>(() => {
    return new EditorView({
      state,
      dispatch: tr => {
        view.update([tr])
        if (isMounted.current) {
          setState(view.state)
        }
      },
    })
  })

  const highlightLocations = state.field(highlightLocationsField)

  // Append the editor view DOM to the container node when mounted
  const containerRef = useCallback(
    node => {
      if (node) {
        node.appendChild(view.dom)
      }
    },
    [view]
  )

  const scrollToPrevious = useCallback(() => {
    if (highlightLocations.previous) {
      scrollToHighlight(view, highlightLocations.previous)
    }
  }, [highlightLocations.previous, view])

  const scrollToNext = useCallback(() => {
    if (highlightLocations.next) {
      scrollToHighlight(view, highlightLocations.next)
    }
  }, [highlightLocations.next, view])

  const { before, after } = highlightLocations

  useEffect(() => {
    const effects: StateEffect<unknown>[] = [setHighlightsEffect.of(highlights)]
    if (highlights.length > 0) {
      const { from, to } = highlights[0].range
      effects.push(
        EditorView.scrollIntoView(EditorSelection.range(from, to), {
          y: 'center',
        })
      )
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: doc },
      effects,
    })
  }, [doc, highlights, view])

  return (
    <div className="document-diff-container">
      <div ref={containerRef} className="cm-viewer-container" />
      {before > 0 ? (
        <button
          className="btn btn-secondary previous-highlight-button"
          onClick={scrollToPrevious}
        >
          <Icon type="arrow-up" />
          &nbsp;
          {t('n_more_updates_above', { count: before })}
        </button>
      ) : null}
      {after > 0 ? (
        <button
          className="btn btn-secondary next-highlight-button"
          onClick={scrollToNext}
        >
          <Icon type="arrow-down" />
          &nbsp;
          {t('n_more_updates_below', { count: after })}
        </button>
      ) : null}
    </div>
  )
}

export default withErrorBoundary(DocumentDiffViewer, ErrorBoundaryFallback)
