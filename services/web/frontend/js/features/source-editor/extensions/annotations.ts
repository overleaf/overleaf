import { EditorView, ViewUpdate } from '@codemirror/view'
import { Diagnostic, linter, lintGutter } from '@codemirror/lint'
import {
  Compartment,
  RangeSet,
  RangeValue,
  StateEffect,
  StateField,
  Text,
} from '@codemirror/state'
import { Annotation } from '../../../../../types/annotation'

const compileLintSourceConf = new Compartment()

export const annotations = () => [
  compileDiagnosticsState,
  compileLintSourceConf.of(compileLogLintSource()),
  lintGutter({
    hoverTime: 0,
  }),
  // move the lint gutter outside the line numbers
  EditorView.baseTheme({
    '.cm-gutter-lint': {
      order: -1,
    },
  }),
]

export const lintSourceConfig = {
  delay: 100,
  // Show highlights only for errors
  markerFilter(diagnostics: readonly Diagnostic[]) {
    return diagnostics.filter(d => d.severity === 'error')
  },
  // Do not show any tooltips for highlights within the editor content
  tooltipFilter() {
    return []
  },
  needsRefresh(update: ViewUpdate) {
    return update.selectionSet
  },
}

const compileLogLintSource = () =>
  linter(view => {
    const items: Diagnostic[] = []
    const cursor = view.state.field(compileDiagnosticsState).iter()
    while (cursor.value !== null) {
      items.push({
        ...cursor.value.diagnostic,
        from: cursor.from,
        to: cursor.to,
      })
      cursor.next()
    }
    return items
  }, lintSourceConfig)

class DiagnosticRangeValue extends RangeValue {
  constructor(public diagnostic: Diagnostic) {
    super()
  }
}

const setCompileDiagnosticsEffect = StateEffect.define<Diagnostic[]>()

export const compileDiagnosticsState = StateField.define<
  RangeSet<DiagnosticRangeValue>
>({
  create() {
    return RangeSet.empty
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setCompileDiagnosticsEffect)) {
        return RangeSet.of(
          effect.value.map(diagnostic =>
            new DiagnosticRangeValue(diagnostic).range(
              diagnostic.from,
              diagnostic.to
            )
          ),
          true
        )
      }
    }

    if (transaction.docChanged) {
      value = value.map(transaction.changes)
    }

    return value
  },
})

export const setAnnotations = (doc: Text, annotations: Annotation[]) => {
  const diagnostics: Diagnostic[] = []

  for (const annotation of annotations) {
    // ignore "whole document" (row: -1) annotations
    if (annotation.row !== -1) {
      try {
        diagnostics.push(convertAnnotationToDiagnostic(doc, annotation))
      } catch (error) {
        // ignore invalid annotations
        console.debug('invalid annotation position', error)
      }
    }
  }

  return {
    effects: setCompileDiagnosticsEffect.of(diagnostics),
  }
}

export const showCompileLogDiagnostics = (show: boolean) => {
  return {
    effects: [
      // reconfigure the compile log lint source
      compileLintSourceConf.reconfigure(show ? compileLogLintSource() : []),
    ],
  }
}

const convertAnnotationToDiagnostic = (
  doc: Text,
  annotation: Annotation
): Diagnostic => {
  if (annotation.row < 0) {
    throw new Error(`Invalid annotation row ${annotation.row}`)
  }

  const line = doc.line(annotation.row + 1)

  return {
    from: line.from,
    to: line.to, // NOTE: highlight whole line as synctex doesn't output column number
    severity: annotation.type,
    message: annotation.text,
    // source: annotation.source, // NOTE: the source is displayed in the tooltip
  }
}
