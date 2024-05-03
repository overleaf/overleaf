import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'

export const getListType = (
  state: EditorState,
  listEnvironmentNode: SyntaxNode
) => {
  const beginEnvNameNode = listEnvironmentNode
    .getChild('BeginEnv')
    ?.getChild('EnvNameGroup')
    ?.getChild('ListEnvName')

  const endEnvNameNode = listEnvironmentNode
    .getChild('EndEnv')
    ?.getChild('EnvNameGroup')
    ?.getChild('ListEnvName')

  if (beginEnvNameNode && endEnvNameNode) {
    return state.sliceDoc(beginEnvNameNode.from, beginEnvNameNode.to).trim()
  }
}
