import { CompletionContext } from '@codemirror/autocomplete'
import {
  extendOverUnpairedClosingBrace,
  extendRequiredParameter,
} from './apply'
import { Folder } from '../../../../../../../types/folder'
import { Completions } from './types'
import { metadataState } from '../../../extensions/language'

// TODO: case-insensitive regex

function removeBibExtension(path: string) {
  return path.replace(/\.bib$/, '')
}

function removeTexExtension(path: string) {
  return path.replace(/\.tex$/, '')
}

/**
 * Completions based on files in the project
 */
export function buildIncludeCompletions(
  completions: Completions,
  context: CompletionContext
) {
  const metadata = context.state.field(metadataState, false)

  if (!metadata?.fileTreeData) {
    return
  }

  // files in the project folder
  const processFile = (path: string) => {
    if (/\.(?:tex|txt)$/.test(path)) {
      // path parameter for \include{path} or \input{path}
      completions.includes.push({
        type: 'file',
        label: path,
        apply: removeTexExtension(path),
        extend: extendRequiredParameter,
      })

      // \include{path}
      completions.commands.push({
        type: 'cmd',
        label: `\\include{${path}}`,
        apply: `\\include{${removeTexExtension(path)}}`,
        extend: extendOverUnpairedClosingBrace,
      })

      // \input{path}
      completions.commands.push({
        type: 'cmd',
        label: `\\input{${path}}`,
        apply: `\\input{${removeTexExtension(path)}}`,
        extend: extendOverUnpairedClosingBrace,
      })

      // \subfile{path}
      completions.commands.push({
        type: 'cmd',
        label: `\\subfile{${path}}`,
        apply: `\\subfile{${removeTexExtension(path)}}`,
        extend: extendOverUnpairedClosingBrace,
      })
    }

    // TODO: a better list of graphics extensions?
    if (/\.(eps|jpe?g|gif|png|tiff?|pdf|svg)$/i.test(path)) {
      // path parameter for \includegraphics{path}
      completions.graphics.push({
        type: 'file',
        label: path,
        extend: extendRequiredParameter,
      })

      completions.commands.push({
        type: 'cmd',
        label: `\\includegraphics{${path}}`,
        extend: extendOverUnpairedClosingBrace,
      })
    }

    if (/\.bib$/.test(path)) {
      const label = removeBibExtension(path)
      // path without extension for \bibliography{path}
      completions.bibliographies.push({
        type: 'bib',
        label,
        extend: extendRequiredParameter,
      })
    }
  }

  // iterate through the files in a folder
  const processFolder = ({ folders, docs, fileRefs }: Folder, path = '') => {
    for (const doc of docs) {
      processFile(`${path}${doc.name}`)
    }

    for (const fileRef of fileRefs) {
      processFile(`${path}${fileRef.name}`)
    }

    for (const folder of folders) {
      processFolder(folder, `${path}${folder.name}/`)
    }
  }

  processFolder(metadata.fileTreeData)
}
