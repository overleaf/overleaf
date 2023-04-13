import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { previousSiblingIs } from './common'
import { NodeIntersectsChangeFn, ProjectionItem } from './projection'

const HUNDRED_MS = 100

export class EnvironmentName extends ProjectionItem {
  title = ''
}

export const enterNode = (
  state: EditorState,
  node: SyntaxNodeRef,
  items: EnvironmentName[],
  nodeIntersectsChange: NodeIntersectsChangeFn
): any => {
  if (node.type.is('EnvNameGroup')) {
    if (!nodeIntersectsChange(node.node)) {
      return false
    }
    if (!node.node.prevSibling?.type.is('Begin')) {
      return false
    }
    const openBraceNode = node.node.getChild('OpenBrace')
    if (!openBraceNode) {
      return false
    }
    const envNameNode = openBraceNode.node.nextSibling
    if (!envNameNode) {
      return false
    }
    const envNameText = state.doc.sliceString(envNameNode.from, envNameNode.to)

    if (envNameText.length < 1) {
      return false
    }

    const thisEnvironmentName = {
      title: envNameText,
      from: envNameNode.from,
      to: envNameNode.to,
      line: state.doc.lineAt(envNameNode.from).number,
    }

    items.push(thisEnvironmentName)
  } else if (
    node.type.is('NewEnvironment') ||
    node.type.is('RenewEnvironment')
  ) {
    if (!nodeIntersectsChange(node.node)) {
      // This should already be in `items`
      return false
    }

    const envNameNode = node.node.getChild('LiteralArgContent')
    if (!envNameNode) {
      return
    }
    const envNameText = state.doc.sliceString(envNameNode.from, envNameNode.to)

    if (!envNameText) {
      return
    }

    const thisEnvironmentName = {
      title: envNameText,
      from: envNameNode.from,
      to: envNameNode.to,
      line: state.doc.lineAt(envNameNode.from).number,
    }

    items.push(thisEnvironmentName)
  }
}

export const cursorIsAtBeginEnvironment = (
  state: EditorState,
  pos: number
): boolean | undefined => {
  const tree = ensureSyntaxTree(state, pos, HUNDRED_MS)
  if (!tree) {
    return
  }
  let thisNode = tree.resolve(pos)
  if (!thisNode) {
    return
  }
  if (
    thisNode.type.is('EnvNameGroup') &&
    previousSiblingIs(state, pos, 'Begin')
  ) {
    return true
  } else if (
    thisNode.type.is('$Environment') ||
    (thisNode.type.is('LaTeX') && pos === state.doc.length) // We're at the end of the document
  ) {
    // We're at a malformed `\begin{`, resolve leftward
    thisNode = tree.resolve(pos, -1)
    if (!thisNode) {
      return
    }
    // TODO: may need to handle various envnames
    if (thisNode.type.is('OpenBrace') || thisNode.type.is('$EnvName')) {
      return true
    }
  }
}

export const cursorIsAtEndEnvironment = (
  state: EditorState,
  pos: number
): boolean | undefined => {
  const tree = ensureSyntaxTree(state, pos, HUNDRED_MS)
  if (!tree) {
    return
  }
  let thisNode = tree.resolve(pos)
  if (!thisNode) {
    return
  }
  if (
    thisNode.type.is('EnvNameGroup') &&
    previousSiblingIs(state, pos, 'End')
  ) {
    return true
  } else if (thisNode.type.is('$Environment') || thisNode.type.is('Content')) {
    // We're at a malformed `\end{`, resolve leftward
    thisNode = tree.resolve(pos, -1)
    if (!thisNode) {
      return
    }
    // TODO: may need to handle various envnames
    if (thisNode.type.is('OpenBrace') || thisNode.type.is('EnvName')) {
      return true
    }
  }
}

export const findDocumentEnvironment = (state: EditorState): number | null => {
  const tree = ensureSyntaxTree(state, state.doc.length, HUNDRED_MS)
  let position: number | null = null
  tree?.iterate({
    enter(nodeRef) {
      if (position !== null) {
        return false
      }
      if (nodeRef.type.is('DocumentEnvironment')) {
        position = nodeRef.node.getChild('Content')?.from || null
        return false
      }
    },
  })
  return position
}

/**
 *
 * @param node A node of type `$Environment`, `BeginEnv`, or `EndEnv`
 * @param state The editor state to read the name from
 * @returns The editor name or null if a name cannot be found
 */
export function getEnvironmentName(
  node: SyntaxNode | null,
  state: EditorState
): string | null {
  if (node?.type.is('$Environment')) {
    node = node.getChild('BeginEnv')
  }

  if (!node?.type.is('BeginEnv') && !node?.type.is('EndEnv')) {
    return null
  }

  const nameNode = node
    ?.getChild('EnvNameGroup')
    ?.getChild('OpenBrace')?.nextSibling
  if (!nameNode) {
    return null
  }
  // the name node is a parameter in the grammar, so we have no good way to
  // target the specific type
  if (nameNode.type.is('CloseBrace')) {
    return null
  }
  return state.sliceDoc(nameNode.from, nameNode.to)
}

export function getEnvironmentArguments(environmentNode: SyntaxNode) {
  return environmentNode.getChild('BeginEnv')?.getChildren('TextArgument')
}
