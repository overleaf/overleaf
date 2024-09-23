import { EditorState } from '@codemirror/state'
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { childOfNodeWithType, getOptionalArgumentText } from './common'
import { NodeIntersectsChangeFn, ProjectionItem } from './projection'

/**
 * A projection of a command in the document
 */
export class Command extends ProjectionItem {
  readonly title: string = ''
  readonly optionalArgCount: number | undefined = 0
  readonly requiredArgCount: number | undefined = 0
  readonly type: 'usage' | 'definition' = 'usage'
  readonly raw: string | undefined = undefined
  readonly ignoreInAutocomplete?: boolean = false
}

const getCommandName = (
  node: SyntaxNode,
  state: EditorState,
  childTypes: string[]
): string | null => {
  const child = childOfNodeWithType(node, ...childTypes)

  if (child) {
    const commandName = state.doc.sliceString(child.from, child.to)
    if (commandName.length > 0) {
      return commandName
    }
  }

  return null
}

/**
 * Extracts Command instances from the syntax tree.
 * `\newcommand`, `\renewcommand`, `\newenvironment`, `\renewenvironment`
 * and `\def` are treated specially.
 */
export const enterNode = (
  state: EditorState,
  node: SyntaxNodeRef,
  items: Command[],
  nodeIntersectsChange: NodeIntersectsChangeFn
): any => {
  if (node.type.is('NewCommand') || node.type.is('RenewCommand')) {
    if (!nodeIntersectsChange(node.node)) {
      // This should already be in `items`
      return
    }

    const commandName = getCommandName(node.node, state, [
      'LiteralArgContent',
      'Csname',
    ])

    if (commandName === null) {
      return
    }

    const optionalArguments = node.node.getChildren('OptionalArgument')

    let argCountNumber = 0
    if (optionalArguments.length > 0) {
      const argumentCountNode = optionalArguments[0]
      const argCountText = getOptionalArgumentText(state, argumentCountNode)
      if (argCountText) {
        try {
          argCountNumber = parseInt(argCountText, 10)
        } catch (err) {}
      }
    }

    const commandDefinitionHasOptionalArgument = optionalArguments.length === 2

    if (commandDefinitionHasOptionalArgument && argCountNumber > 0) {
      argCountNumber--
    }

    items.push({
      line: state.doc.lineAt(node.from).number,
      title: commandName,
      from: node.from,
      to: node.to,
      optionalArgCount: commandDefinitionHasOptionalArgument ? 1 : 0,
      requiredArgCount: argCountNumber,
      type: 'definition',
      raw: state.sliceDoc(node.from, node.to),
    })
  } else if (node.type.is('Def')) {
    if (!nodeIntersectsChange(node.node)) {
      // This should already be in `items`
      return
    }

    const commandName = getCommandName(node.node, state, ['Csname', 'CtrlSym'])

    if (commandName === null) {
      return
    }

    const requiredArgCount = node.node.getChildren('MacroParameter').length
    const optionalArgCount = node.node.getChildren(
      'OptionalMacroParameter'
    ).length

    items.push({
      line: state.doc.lineAt(node.from).number,
      title: commandName,
      from: node.from,
      to: node.to,
      optionalArgCount,
      requiredArgCount,
      type: 'definition',
      raw: state.sliceDoc(node.from, node.to),
    })
  } else if (node.type.is('Let')) {
    if (!nodeIntersectsChange(node.node)) {
      // This should already be in `items`
      return
    }

    const commandName = getCommandName(node.node, state, ['Csname'])

    if (commandName === null) {
      return
    }
    items.push({
      line: state.doc.lineAt(node.from).number,
      title: commandName,
      from: node.from,
      to: node.to,
      ignoreInAutocomplete: true, // Ignoring since we don't know the argument counts
      optionalArgCount: undefined,
      requiredArgCount: undefined,
      type: 'definition',
      raw: state.sliceDoc(node.from, node.to),
    })
  } else if (
    node.type.is('UnknownCommand') ||
    node.type.is('KnownCommand') ||
    node.type.is('MathUnknownCommand') ||
    node.type.is('DefinitionFragmentUnknownCommand')
  ) {
    if (!nodeIntersectsChange(node.node)) {
      // This should already be in `items`
      return
    }

    let commandNode: SyntaxNode | null = node.node
    if (node.type.is('KnownCommand')) {
      // KnownCommands are defined as
      //
      // KnownCommand {
      //    CommandName {
      //       CommandCtrlSeq [args]
      //    }
      // }
      // So for a KnownCommand, use the first child as the actual command node
      commandNode = commandNode.firstChild
    }

    if (!commandNode) {
      return
    }

    const ctrlSeq = commandNode.getChild('$CtrlSeq')
    if (!ctrlSeq) {
      return
    }

    if (ctrlSeq.type.is('$CtrlSym')) {
      return
    }

    const optionalArguments = commandNode.getChildren('OptionalArgument')
    const commandArgumentsIncludingOptional =
      commandNode.getChildren('$Argument')
    const text = state.doc.sliceString(ctrlSeq.from, ctrlSeq.to)

    items.push({
      line: state.doc.lineAt(commandNode.from).number,
      title: text,
      from: commandNode.from,
      to: commandNode.to,
      optionalArgCount: optionalArguments.length,
      requiredArgCount:
        commandArgumentsIncludingOptional.length - optionalArguments.length,
      type: 'usage',
      raw: undefined,
    })
  }
}

const texOrPdfArgument = { tex: 0, pdf: 1 }

export const texOrPdfString = (
  state: EditorState,
  node: SyntaxNode,
  version: keyof typeof texOrPdfArgument
) => {
  const commandName = getCommandName(node.node, state, ['CtrlSeq'])
  if (commandName === '\\texorpdfstring') {
    const argumentNode = node
      .getChildren('TextArgument')
      [texOrPdfArgument[version]]?.getChild('LongArg')
    if (argumentNode) {
      return state.doc.sliceString(argumentNode.from, argumentNode.to)
    }
  }
}
