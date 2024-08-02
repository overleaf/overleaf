import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState, SelectionRange } from '@codemirror/state'
import { SyntaxNode, Tree } from '@lezer/common'
import { ListEnvironment } from '../../lezer-latex/latex.terms.mjs'

const HUNDRED_MS = 100

export type AncestorItem = {
  node: SyntaxNode
  label: string
  type?: string
  from: number
  to: number
}

/**
 * Get the stack of 'ancestor' nodes at the given position.
 * The first element is the most distant ancestor, while the last element
 * is the node at the position.
 */
export function getAncestorStack(
  state: EditorState,
  pos: number
): AncestorItem[] | null {
  const tree = ensureSyntaxTree(state, pos, HUNDRED_MS)

  if (!tree) {
    return null
  }

  const stack: AncestorItem[] = []
  const selectedNode = tree.resolve(pos, 0)

  let node: SyntaxNode | null = selectedNode
  while (node) {
    const name = node.type.name
    switch (name) {
      case 'Environment':
        {
          const data: AncestorItem = {
            node,
            label: name,
            from: node.from,
            to: node.to,
          }

          const child = node.getChild('EnvNameGroup')
          if (child) {
            data.type = state.doc.sliceString(child.from + 1, child.to - 1)
          }
          stack.push(data)
        }
        break

      default:
        stack.push({ node, label: name, from: node.from, to: node.to })
        break
    }

    node = node.parent
  }

  return stack.reverse()
}

export const wrappedNodeOfType = (
  state: EditorState,
  range: SelectionRange,
  type: string | number
): SyntaxNode | null => {
  if (range.empty) {
    return null
  }

  const ancestorNode = ancestorNodeOfType(state, range.from, type, 1)

  if (
    ancestorNode &&
    ancestorNode.from === range.from &&
    ancestorNode.to === range.to
  ) {
    return ancestorNode
  }

  return null
}

export const ancestorNodeOfType = (
  state: EditorState,
  pos: number,
  type: string | number,
  side: -1 | 0 | 1 = 0
): SyntaxNode | null => {
  const node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side)
  return ancestorOfNodeWithType(node, type)
}

export function* ancestorsOfNodeWithType(
  node: SyntaxNode | null,
  type: string | number
): Generator<SyntaxNode> {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type.is(type)) {
      yield ancestor
    }
  }
}

export const ancestorOfNodeWithType = (
  node: SyntaxNode | null | undefined,
  ...types: (string | number)[]
): SyntaxNode | null => {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
    for (const type of types) {
      if (ancestor.type.is(type)) {
        return ancestor
      }
    }
  }
  return null
}

export const lastAncestorAtEndPosition = (
  node: SyntaxNode | null | undefined,
  to: number
): SyntaxNode | null => {
  let lastAncestor: SyntaxNode | null = null
  for (
    let ancestor = node;
    ancestor && ancestor.to === to;
    ancestor = ancestor.parent
  ) {
    lastAncestor = ancestor
  }
  return lastAncestor
}

export const descendantsOfNodeWithType = (
  node: SyntaxNode,
  type: string | number,
  leaveType?: string | number
): SyntaxNode[] => {
  const children: SyntaxNode[] = []

  node.cursor().iterate(nodeRef => {
    if (nodeRef.type.is(type)) {
      children.push(nodeRef.node)
    }
    if (leaveType && nodeRef.type.is(leaveType) && nodeRef.node !== node) {
      return false
    }
  })

  return children
}

export const getBibkeyArgumentNode = (state: EditorState, pos: number) => {
  return (
    ancestorNodeOfType(state, pos, 'BibKeyArgument', -1) ??
    ancestorNodeOfType(state, pos, 'BibKeyArgument')
  )
}

export function* ancestorsOfSelectionWithType(
  tree: Tree,
  selection: EditorSelection,
  type: string | number
) {
  for (const range of selection.ranges) {
    const node = tree.resolveInner(range.anchor)
    for (const ancestor of ancestorsOfNodeWithType(node, type)) {
      if (ancestor) {
        yield ancestor
      }
    }
  }
}

export const matchingAncestor = (
  node: SyntaxNode,
  predicate: (node: SyntaxNode) => boolean
) => {
  for (
    let ancestor: SyntaxNode | null | undefined = node;
    ancestor;
    ancestor = ancestor.parent
  ) {
    if (predicate(ancestor)) {
      return ancestor
    }
  }
  return null
}

export const ancestorWithType = (
  state: EditorState,
  nodeType: string | number
) => {
  const tree = syntaxTree(state)

  const ancestors = ancestorsOfSelectionWithType(
    tree,
    state.selection,
    nodeType
  )

  return ancestors.next().value
}

export const commonAncestor = (
  nodeA: SyntaxNode,
  nodeB: SyntaxNode
): SyntaxNode | null => {
  let cursorA: SyntaxNode | null = nodeA
  let cursorB: SyntaxNode | null = nodeB
  while (cursorA && cursorB) {
    if (cursorA === cursorB) {
      return cursorA
    }
    if (cursorA.from < cursorB.from) {
      cursorB = cursorB.parent
    } else {
      cursorA = cursorA.parent
    }
  }
  return null
}

export type ListEnvironmentName = 'itemize' | 'enumerate' | 'description'

export const listDepthForNode = (node: SyntaxNode) => {
  let depth = 0
  for (const ancestor of ancestorsOfNodeWithType(node, ListEnvironment)) {
    if (ancestor) {
      depth++
    }
  }
  return depth
}

export const minimumListDepthForSelection = (state: EditorState) => {
  const depths = []
  for (const range of state.selection.ranges) {
    const tree = syntaxTree(state)
    const node = tree.resolveInner(range.anchor)
    depths.push(listDepthForNode(node))
  }
  return Math.min(...depths)
}

export const isDirectChildOfEnvironment = (
  child?: SyntaxNode | null,
  ancestor?: SyntaxNode | null
) => {
  const possiblyAncestor = child?.parent?.parent?.parent // Text → Content → Environment
  return ancestor === possiblyAncestor
}
