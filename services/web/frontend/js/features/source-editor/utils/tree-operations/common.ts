import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { IterMode, SyntaxNode, SyntaxNodeRef, Tree } from '@lezer/common'

const HUNDRED_MS = 100

export function iterateDescendantsOf(
  tree: Tree,
  ancestors: (string | number)[],
  spec: {
    enter(node: SyntaxNodeRef): boolean | void
    leave?(node: SyntaxNodeRef): void
    from?: number | undefined
    to?: number | undefined
    mode?: IterMode | undefined
  }
) {
  const filteredEnter = (node: SyntaxNodeRef): boolean | void => {
    if (!ancestors.some(x => node.type.is(x))) {
      return false
    }
    return spec.enter(node)
  }
  tree.iterate({ ...spec, enter: filteredEnter })
}

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

export const nextSiblingIs = (
  state: EditorState,
  pos: number,
  expectedName: string
): boolean | null => {
  const tree = ensureSyntaxTree(state, pos, HUNDRED_MS)
  if (!tree) {
    return null
  }
  const thisNode = tree.resolve(pos)
  const previousNode = thisNode?.nextSibling
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
