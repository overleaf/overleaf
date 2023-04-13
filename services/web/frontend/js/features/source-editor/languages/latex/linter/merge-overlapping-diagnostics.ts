import { Diagnostic } from '@codemirror/lint'
import { Range } from '../../../utils/range'

const diagnosticsTouchOrOverlap = (d1: Diagnostic, d2: Diagnostic) => {
  return new Range(d1.from, d1.to).touchesOrIntersects(
    new Range(d2.from, d2.to)
  )
}

const mergeDiagnostics = (d1: Diagnostic, d2: Diagnostic) => {
  const diagnostic: Diagnostic = {
    from: Math.min(d1.from, d2.from),
    to: Math.max(d1.to, d2.to),
    severity: d1.severity,
    message: d1.message,
  }
  if ('source' in d1) {
    diagnostic.source = d1.source
  }
  return diagnostic
}

const mergeOverlappingDiagnostics = (diagnostics: Diagnostic[]) => {
  const diagnosticsByMessage = new Map()
  for (const diagnostic of diagnostics) {
    let diagnosticsForMessage = diagnosticsByMessage.get(diagnostic.message)
    if (diagnosticsForMessage) {
      diagnosticsForMessage.push(diagnostic)
      diagnosticsForMessage.sort(
        (d1: Diagnostic, d2: Diagnostic) => d1.from - d2.from
      )
      for (let i = 1; i < diagnosticsForMessage.length; ) {
        const d1 = diagnosticsForMessage[i - 1]
        const d2 = diagnosticsForMessage[i]
        if (diagnosticsTouchOrOverlap(d1, d2)) {
          // Merge second diagnostic into first and remove it
          diagnosticsForMessage[i - 1] = mergeDiagnostics(d1, d2)
          diagnosticsForMessage.splice(i, 1)
        } else {
          ++i
        }
      }
    } else {
      diagnosticsForMessage = [diagnostic]
      diagnosticsByMessage.set(diagnostic.message, diagnosticsForMessage)
    }
  }
  return Array.from(diagnosticsByMessage.values()).flat()
}

// Group objects of a specified type by a single property and return an array
// of arrays, one array per property value
const groupBy = function <T>(arr: T[], prop: keyof T) {
  const grouped = new Map<T[keyof T], T[]>()
  for (const item of arr) {
    const key = item[prop]
    let group = grouped.get(key)
    if (!group) {
      group = [] as T[]
      grouped.set(key, group)
    }
    group.push(item)
  }
  return Array.from(grouped.values())
}

export const mergeCompatibleOverlappingDiagnostics = (
  diagnostics: Diagnostic[]
) => {
  const allMergedDiagnostics = []

  // Partition by diagnostic source (compiler or linter)
  for (const diagnosticsForSource of groupBy(diagnostics, 'source')) {
    // Partition into severities
    const diagnosticsBySeverity = groupBy(diagnosticsForSource, 'severity')

    // Merge overlapping diagnostics for each severity in turn
    for (const diagnosticsForSeverity of diagnosticsBySeverity) {
      allMergedDiagnostics.push(
        ...mergeOverlappingDiagnostics(diagnosticsForSeverity)
      )
    }
  }

  return allMergedDiagnostics
}
