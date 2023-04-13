import { syntaxTree } from '@codemirror/language'
import { Line } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { SyntaxNodeRef } from '@lezer/common'
import OError from '@overleaf/o-error'

/* A convenient wrapper around 'Normal' tokens */
export class NormalTextSpan {
  public from: number
  public to: number
  public lineNumber: number
  public text: string
  public node: SyntaxNodeRef

  constructor(options: {
    from: number
    to: number
    lineNumber: number
    text: string
    node: SyntaxNodeRef
  }) {
    const { from, to, lineNumber, text, node } = options
    if (
      text == null ||
      from == null ||
      to == null ||
      lineNumber == null ||
      node == null
    ) {
      throw new OError('TreeQuery: invalid NormalTextSpan').withInfo({
        options,
      })
    }
    this.from = from
    this.to = to
    this.text = text
    this.node = node
    this.lineNumber = lineNumber
  }
}

const NotNormalNodeAncestors = [
  'Include',
  'Input',
  'IncludeGraphics',
  'Cite',
  'LabelArgument',
  'UsePackage',
  'PackageArgument',
  'EnvNameGroup',
  'RefArgument',
]

export const getNormalTextSpansFromLine = (
  view: EditorView,
  line: Line
): Array<NormalTextSpan> => {
  const lineNumber = line.number
  const lineStart = line.from
  const lineEnd = line.to
  const tree = syntaxTree(view.state)
  const normalTextSpans: Array<NormalTextSpan> = []
  tree?.iterate({
    from: lineStart,
    to: lineEnd,
    enter: (node: SyntaxNodeRef) => {
      if (NotNormalNodeAncestors.includes(node.type.name)) {
        return false
      }
      if (node.type.name === 'Normal') {
        normalTextSpans.push(
          new NormalTextSpan({
            from: node.from,
            to: node.to,
            text: view.state.doc.sliceString(node.from, node.to),
            lineNumber,
            node,
          })
        )
        return false
      }
      return true
    },
  })
  return normalTextSpans
}
