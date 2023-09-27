import { indentService } from '@codemirror/language'
import { debugConsole } from '@/utils/debugging'

export const latexIndentService = () => {
  return indentService.of((indentContext, pos) => {
    try {
      // match the indentation of the previous line (if present)
      const previousLine = indentContext.state.doc.lineAt(pos)
      const whitespace = previousLine.text.match(/^\s*/)
      if (whitespace) {
        return whitespace[0].length
      }
    } catch (err) {
      debugConsole.error('Error in CM indentService', err)
    }
    return null
  })
}
