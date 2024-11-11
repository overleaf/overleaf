import { indentService } from '@codemirror/language'

export const latexIndentService = () =>
  indentService.of((indentContext, pos) => {
    // only use this for insertNewLineAndIndent
    if (indentContext.simulatedBreak) {
      // match the indentation of the previous line (if present)
      return null
    }
  })
