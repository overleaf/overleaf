import { CompletionContext, CompletionSource } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import { ancestorOfNodeWithType } from './ancestors'

export const ifInType = (
  type: string,
  source: CompletionSource
): CompletionSource => {
  return (context: CompletionContext) => {
    const tree = syntaxTree(context.state)
    let node: SyntaxNode | null = tree.resolveInner(context.pos, -1)
    while (node) {
      if (node.type.is(type)) {
        return source(context)
      }
      node = node.parent
    }
    return null
  }
}

export function isInEmptyArgumentNodeForAutocomplete(state: EditorState) {
  const main = state.selection.main
  if (!main.empty) {
    return false
  }

  const pos = main.anchor
  const tree = syntaxTree(state)

  if (tree.length < pos) {
    return false
  }

  const nodeLeft = tree.resolveInner(pos, -1)
  if (!nodeLeft.type.is('OpenBrace')) {
    return false
  }

  const nodeRight = tree.resolveInner(pos, 1)
  if (!nodeRight.type.is('CloseBrace')) {
    return false
  }

  const ancestor = ancestorOfNodeWithType(
    nodeLeft,
    'EnvNameGroup',
    'BibliographyStyleArgument',
    'BibliographyArgument',
    'BibKeyArgument',
    'DocumentClassArgument',
    'FilePathArgument',
    'RefArgument',
    'PackageArgument'
  )
  if (!ancestor) {
    return false
  }

  return ancestor.from === nodeLeft.from && ancestor.to === nodeRight.to
}
