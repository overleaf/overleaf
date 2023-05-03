import { EditorState } from '@codemirror/state'
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { getOptionalArgumentText } from './common'
import { NodeIntersectsChangeFn, ProjectionItem } from './projection'

/**
 * A projection of a command in the document
 */
export class Command extends ProjectionItem {
  title = ''
  optionalArgCount = 0
  requiredArgCount = 0
}

/**
 * Extracts Command instances from the syntax tree.
 * `\newcommand` and `\renewcommand` are treated specially
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
    let commandName = node.node.getChild('LiteralArgContent')
    if (!commandName) {
      commandName = node.node.getChild('Csname')
    }
    if (!commandName) {
      return
    }
    const commandNameText = state.doc.sliceString(
      commandName.from,
      commandName.to
    )

    if (commandNameText.length < 1) {
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

    const thisCommand = {
      line: state.doc.lineAt(node.from).number,
      title: commandNameText,
      from: node.from,
      to: node.to,
      optionalArgCount: commandDefinitionHasOptionalArgument ? 1 : 0,
      requiredArgCount: argCountNumber,
    }

    items.push(thisCommand)
  } else if (
    node.type.is('UnknownCommand') ||
    node.type.is('MathCommand') ||
    node.type.is('KnownCommand')
  ) {
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
    if (!nodeIntersectsChange(node.node)) {
      // This should already be in `items`
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
    const commandArguments = commandNode.getChildren('$Argument')
    const text = state.doc.sliceString(ctrlSeq.from, ctrlSeq.to)

    const thisCommand = {
      line: state.doc.lineAt(commandNode.from).number,
      title: text,
      from: commandNode.from,
      to: commandNode.to,
      optionalArgCount: optionalArguments.length,
      requiredArgCount: commandArguments.length,
    }
    items.push(thisCommand)
  }
}
