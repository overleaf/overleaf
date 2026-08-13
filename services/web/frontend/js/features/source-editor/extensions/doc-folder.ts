import {
  Compartment,
  Extension,
  Facet,
  TransactionSpec,
} from '@codemirror/state'

const docFolderConf = new Compartment()

/**
 * Folder of the open document (null at the project root), for resolving
 * document-relative file paths.
 */
export const docFolderFacet = Facet.define<string | null, string | null>({
  combine: values => values[0] ?? null,
})

export const docFolder = (docFolder: string | null): Extension =>
  docFolderConf.of(docFolderFacet.of(docFolder))

export const setDocFolder = (docFolder: string | null): TransactionSpec => ({
  effects: docFolderConf.reconfigure(docFolderFacet.of(docFolder)),
})
