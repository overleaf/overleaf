import { EditorState, SelectionRange } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  commonAncestor,
  matchingAncestor,
} from '@/features/source-editor/utils/tree-operations/ancestors'


//Added formating command of slant text
export type FormattingCommand = '\\textbf' | '\\textit' | '\\textsl' | '\\textcolor'
export type FormattingNodeType = string | number


//paired command with name of command
export const formattingCommandMap: Record<
  FormattingCommand,
  FormattingNodeType
> = {
  '\\textbf': 'TextBoldCommand',
  '\\textit': 'TextItalicCommand',
  '\\textsl': 'TextSlantCommand',
  '\\textcolor': 'TextColorCommand',
}

export const withinFormattingCommand = (state: EditorState) => {
  const tree = syntaxTree(state)

  return (command: FormattingCommand): boolean => {
    const nodeType = formattingCommandMap[command]

    const isFormattedText = (range: SelectionRange): boolean => {
      const nodeLeft = tree.resolveInner(range.from, -1)
      const formattingCommandLeft = matchingAncestor(nodeLeft, node =>
        node.type.is(nodeType)
      )
      if (!formattingCommandLeft) {
        return false
      }

      // We need to check the other end of the selection, and ensure that they
      // share a common formatting command ancestor
      const nodeRight = tree.resolveInner(range.to, 1)
      const ancestor = commonAncestor(formattingCommandLeft, nodeRight)
      if (!ancestor) {
        return false
      }

      const formattingAncestor = matchingAncestor(ancestor, node =>
        node.type.is(nodeType)
      )
      return Boolean(formattingAncestor)
    }

    return state.selection.ranges.every(isFormattedText)
  }
}
