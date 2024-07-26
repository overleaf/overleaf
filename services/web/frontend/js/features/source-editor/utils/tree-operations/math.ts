import { getEnvironmentName } from './environments'
import { EditorState } from '@codemirror/state'
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { ancestorNodeOfType } from './ancestors'

export type MathContainer = {
  content: string
  displayMode: boolean
  passToMathJax: boolean
  pos: number
}

export const mathAncestorNode = (state: EditorState, pos: number) =>
  ancestorNodeOfType(state, pos, '$MathContainer') ||
  ancestorNodeOfType(state, pos, 'EquationEnvironment') ||
  // NOTE: EquationArrayEnvironment can be nested inside EquationEnvironment
  ancestorNodeOfType(state, pos, 'EquationArrayEnvironment')

export const parseMathContainer = (
  state: EditorState,
  nodeRef: SyntaxNodeRef,
  ancestorNode: SyntaxNode
): MathContainer | null => {
  // the content of the Math element, without braces
  const innerContent = state.doc.sliceString(nodeRef.from, nodeRef.to).trim()

  if (!innerContent.length) {
    return null
  }

  let content = innerContent
  let displayMode = false
  let passToMathJax = true
  let pos = nodeRef.from

  if (ancestorNode.type.is('$Environment')) {
    const environmentName = getEnvironmentName(ancestorNode, state)
    if (environmentName) {
      // use the outer content of environments that MathJax supports
      // https://docs.mathjax.org/en/latest/input/tex/macros/index.html#environments
      if (environmentName === 'tikzcd') {
        passToMathJax = false
      }
      if (environmentName !== 'math' && environmentName !== 'displaymath') {
        content = state.doc
          .sliceString(ancestorNode.from, ancestorNode.to)
          .trim()
        pos = ancestorNode.from
      }

      if (environmentName !== 'math') {
        displayMode = true
      }
    }
  } else {
    if (
      ancestorNode.type.is('BracketMath') ||
      Boolean(ancestorNode.getChild('DisplayMath'))
    ) {
      displayMode = true
    }
  }

  return { content, displayMode, passToMathJax, pos }
}
