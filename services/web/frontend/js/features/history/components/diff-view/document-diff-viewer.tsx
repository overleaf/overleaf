import { useCallback, useEffect, useState } from 'react'
import {
  EditorSelection,
  EditorState,
  Extension,
  StateEffect,
} from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'
import { highlights, setHighlightsEffect } from '../../extensions/highlights'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { theme, Options, setOptionsTheme } from '../../extensions/theme'
import { indentUnit } from '@codemirror/language'
import { Highlight } from '../../services/types/doc'
import useIsMounted from '../../../../shared/hooks/use-is-mounted'
import {
  highlightLocations,
  highlightLocationsField,
  scrollToHighlight,
} from '../../extensions/highlight-locations'
import { useTranslation } from 'react-i18next'
import { inlineBackground } from '../../../source-editor/extensions/inline-background'
import OLButton from '@/shared/components/ol/ol-button'

function extensions(themeOptions: Options): Extension[] {
  return [
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    EditorView.contentAttributes.of({ tabindex: '0' }),
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
  const { userSettings } = useUserSettingsContext()
  const { fontFamily, fontSize, lineHeight } = userSettings
  const isMounted = useIsMounted()
  const { t } = useTranslation()

  const [state, setState] = useState(() => {
    return EditorState.create({
      doc,
      extensions: extensions({
        fontSize,
        fontFamily,
        lineHeight,
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
    (node: HTMLDivElement) => {
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

  // Update the document diff viewer theme whenever the font size, font family
  // or line height user setting changes
  useEffect(() => {
    view.dispatch(
      setOptionsTheme({
        fontSize,
        fontFamily,
        lineHeight,
      })
    )
  }, [view, fontSize, fontFamily, lineHeight])

  return (
    <div className="document-diff-container">
      <div ref={containerRef} className="cm-viewer-container" />
      {before > 0 ? (
        <OLButton
          variant="secondary"
          leadingIcon="arrow_upward"
          onClick={scrollToPrevious}
          className="previous-highlight-button"
        >
          {t('n_more_updates_above', { count: before })}
        </OLButton>
      ) : null}
      {after > 0 ? (
        <OLButton
          variant="secondary"
          leadingIcon="arrow_downward"
          onClick={scrollToNext}
          className="next-highlight-button"
        >
          {t('n_more_updates_below', { count: after })}
        </OLButton>
      ) : null}
    </div>
  )
}

export default DocumentDiffViewer
