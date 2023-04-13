import { CompletionContext } from '@codemirror/autocomplete'
import { createCommandApplier, createRequiredParameterApplier } from './apply'
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
        apply: createRequiredParameterApplier(removeTexExtension(path)),
      })

      // \include{path}
      completions.commands.push({
        type: 'cmd',
        label: `\\include{${path}}`,
        apply: createCommandApplier(`\\include{${removeTexExtension(path)}}`),
      })

      // \input{path}
      completions.commands.push({
        type: 'cmd',
        label: `\\input{${path}}`,
        apply: createCommandApplier(`\\input{${removeTexExtension(path)}}`),
      })
    }

    // TODO: a better list of graphics extensions?
    if (/\.(eps|jpe?g|gif|png|tiff?|pdf|svg)$/.test(path)) {
      // path parameter for \includegraphics{path}
      completions.graphics.push({
        type: 'file',
        label: path,
        apply: createRequiredParameterApplier(path), // TODO: remove extension?
      })

      const label = `\\includegraphics{${path}}`

      // \includegraphics{path}
      completions.commands.push({
        type: 'cmd',
        label,
        apply: createCommandApplier(label),
      })
    }

    if (/\.bib$/.test(path)) {
      const label = removeBibExtension(path)
      // path without extension for \bibliography{path}
      completions.bibliographies.push({
        type: 'bib',
        label,
        apply: createRequiredParameterApplier(label),
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
