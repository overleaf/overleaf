import { Text } from '@codemirror/state'

export const findValidPosition = (
  doc: Text,
  lineNumber: number, // 1-indexed
  columnNumber = 0 // 0-indexed
): number => {
  if (lineNumber < 1) {
    return 0
  }

  const lines = doc.lines

  if (lineNumber > lines) {
    // end of the doc
    return doc.length
  }

  const line = doc.line(lineNumber)

  // requested line and column, or the end of the line
  return Math.min(line.from + columnNumber, line.to)
}
