import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import {
  LongArg,
  ShortArg,
  ShortTextArgument,
  TextArgument,
} from '../../lezer-latex/latex.terms.mjs'

// basic color definitions from the xcolor package
// https://github.com/latex3/xcolor/blob/849682246582946835d28c8f9b2081ff2c340e09/xcolor.dtx#L7051-L7093
const colors = new Map<string, string>([
  ['red', 'rgb(255,0,0)'],
  ['green', 'rgb(0,255,0)'],
  ['blue', 'rgb(0,0,255)'],
  ['brown', 'rgb(195,127,63)'],
  ['lime', 'rgb(195,255,0)'],
  ['orange', 'rgb(255,127,0)'],
  ['pink', 'rgb(255,195,195)'],
  ['purple', 'rgb(195,0,63)'],
  ['teal', 'rgb(0,127,127)'],
  ['violet', 'rgb(127,0,127)'],
  ['cyan', 'rgb(0,255,255)'],
  ['magenta', 'rgb(255,0,255)'],
  ['yellow', 'rgb(255,255,0)'],
  ['olive', 'rgb(127,127,0)'],
  ['black', 'rgb(0,0,0)'],
  ['darkgray', 'rgb(63,63,63)'],
  ['gray', 'rgb(127,127,127)'],
  ['lightgray', 'rgb(195,195,195)'],
  ['white', 'rgb(255,255,255)'],
])

export const parseColorArguments = (
  state: EditorState,
  node: SyntaxNode
): { color: string; from: number; to: number } | undefined => {
  const colorArgumentNode = node.getChild(ShortTextArgument)?.getChild(ShortArg)
  const contentArgumentNode = node.getChild(TextArgument)?.getChild(LongArg)

  if (colorArgumentNode && contentArgumentNode) {
    const { from, to } = contentArgumentNode

    if (to > from) {
      const colorName = state
        .sliceDoc(colorArgumentNode.from, colorArgumentNode.to)
        .trim()

      if (colorName) {
        const color = colors.get(colorName)

        if (color) {
          return { color, from, to }
        }
      }
    }
  }
}
