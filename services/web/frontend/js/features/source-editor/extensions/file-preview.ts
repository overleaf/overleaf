import {
  Compartment,
  Extension,
  Facet,
  TransactionSpec,
} from '@codemirror/state'
import { PreviewPath } from '../../../../../types/preview-path'

export type PreviewByPath = (path: string) => PreviewPath | null

const previewByPathConf = new Compartment()

/**
 * Resolves a path in the project to a preview URL. The value comes from the
 * file tree, so it changes whenever the file tree does. Read it from the state
 * at the point of use rather than capturing it, so decorations and widgets
 * don't hold a resolver for a stale file tree.
 */
export const previewByPathFacet = Facet.define<PreviewByPath, PreviewByPath>({
  combine: values => values[0] ?? (() => null),
})

export const filePreview = (previewByPath: PreviewByPath): Extension =>
  previewByPathConf.of(previewByPathFacet.of(previewByPath))

export const setFilePreview = (
  previewByPath: PreviewByPath
): TransactionSpec => ({
  effects: previewByPathConf.reconfigure(previewByPathFacet.of(previewByPath)),
})
