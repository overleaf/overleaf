import { NodeProp } from '@lezer/common'

/**
 * A node prop that contains an array, each item of which is an array of parent node types that's
 * passed to [matchContext](https://lezer.codemirror.net/docs/ref/#common.SyntaxNodeRef.matchContext)
 * to test whether the node matches the given context. If so, the text in the node is excluded from spell checking.
 * An empty string is treated as a wildcard, so `[['']]` indicates that the node type should always be excluded.
 */
export const noSpellCheckProp = new NodeProp<string[][]>()
