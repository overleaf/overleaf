import { SyntaxNode } from '@lezer/common'
import { parser } from '../../lezer-latex/latex.mjs'
import { childOfNodeWithType } from '../tree-operations/common'

/**
 * Parsing helpers for locating where a custom command is defined across the
 * project. These are pure and worker-safe: the parsing runs in
 * command-definition.worker.ts, off the main thread, so opening the context menu
 * is never blocked.
 *
 * Definitions are parsed with the same lezer-latex grammar the editor uses, so
 * commented-out or verbatim definitions are ignored, and are named by their
 * control sequence, e.g. `\mycmd`.
 */

export type CommandDefinition = {
  name: string
  path: string
  // Document offset of the definition, resolved to a line/cursor position when
  // the defining file is opened.
  pos: number
}

// File extensions worth scanning for command definitions.
const INDEXABLE_EXTENSIONS = ['.tex', '.sty', '.cls', '.def', '.ltx']

export function isIndexablePath(path: string): boolean {
  const lower = path.toLowerCase()
  return INDEXABLE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function sliceChild(
  content: string,
  node: SyntaxNode,
  ...childTypes: string[]
): string | null {
  const child = childOfNodeWithType(node, ...childTypes)
  if (!child) {
    return null
  }
  const text = content.slice(child.from, child.to)
  return text.length > 0 ? text : null
}

/**
 * Parse a document and return the command definitions it contains.
 */
export function parseDefinitionsFromDoc(
  path: string,
  content: string
): CommandDefinition[] {
  const definitions: CommandDefinition[] = []
  const tree = parser.parse(content)

  const push = (name: string | null, pos: number) => {
    if (!name) {
      return
    }
    definitions.push({ name, path, pos })
  }

  tree.iterate({
    enter(nodeRef) {
      const node = nodeRef.node
      switch (nodeRef.type.name) {
        case 'NewCommand':
        case 'RenewCommand':
          push(
            sliceChild(content, node, 'LiteralArgContent', 'Csname'),
            node.from
          )
          break
        case 'Def':
          push(sliceChild(content, node, 'Csname', 'CtrlSym'), node.from)
          break
        case 'Let':
          push(sliceChild(content, node, 'Csname'), node.from)
          break
      }
    },
  })

  return definitions
}

/**
 * Find the first definition of `name` across the given documents. Documents that
 * don't mention the control sequence at all are skipped without parsing (the
 * defined name always appears literally in its definition), and the search stops
 * at the first match.
 */
export function findDefinition(
  docs: { path: string; content: string }[],
  name: string
): CommandDefinition | null {
  for (const { path, content } of docs) {
    if (!content.includes(name)) {
      continue
    }
    const match = parseDefinitionsFromDoc(path, content).find(
      definition => definition.name === name
    )
    if (match) {
      return match
    }
  }
  return null
}
