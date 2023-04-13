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
    const shortArgNodeText = state.doc.sliceString(
      shortArgNode.from,
      shortArgNode.to
    )
    return shortArgNodeText
  }
}

export const resolveNodeAtPos = (
  state: EditorState,
  pos: number,
  side?: -1 | 0 | 1
) => ensureSyntaxTree(state, pos, HUNDRED_MS)?.resolveInner(pos, side) ?? null

export const isUnknownCommandWithName = (
  node: SyntaxNode,
  command: string,
  state: EditorState
): boolean => {
  if (!node.type.is('UnknownCommand')) {
    return false
  }
  const commandNameNode = node.getChild('CtrlSeq')
  if (!commandNameNode) {
    return false
  }
  const commandName = state.doc.sliceString(
    commandNameNode.from,
    commandNameNode.to
  )
  return commandName === command
}
