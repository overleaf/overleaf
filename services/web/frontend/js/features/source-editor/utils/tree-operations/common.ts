import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'

const HUNDRED_MS = 100

export const previousSiblingIs = (
  state: EditorState,
  pos: number,
  expectedName: string
): boolean | null => {
  const tree = ensureSyntaxTree(state, pos, HUNDRED_MS)
  if (!tree) {
    return null
  }
  const thisNode = tree.resolve(pos)
  const previousNode = thisNode?.prevSibling
  return previousNode?.type.name === expectedName
}

export const getOptionalArgumentText = (
  state: EditorState,
  optionalArgumentNode: SyntaxNode
): string | undefined => {
  const shortArgNode = optionalArgumentNode.getChild('ShortOptionalArg')
  if (shortArgNode) {
    return state.doc.sliceString(shortArgNode.from, shortArgNode.to)
  }
}

export const nodeHasError = (node: SyntaxNode): boolean => {
  let hasError = false

  node.cursor().iterate(({ type }) => {
    if (hasError) return false

    if (type.isError) {
      hasError = true
      return false
    }

    return true
  })

  return hasError
}

export const childOfNodeWithType = (
  node: SyntaxNode,
  ...types: (string | number)[]
): SyntaxNode | null => {
  let childOfType: SyntaxNode | null = null

  node.cursor().iterate(child => {
    if (childOfType !== null) {
      return false
    }

    for (const type of types) {
      if (child.type.is(type)) {
        childOfType = child.node
        return false
      }
    }

    return true
  })

  return childOfType
}
