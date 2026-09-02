import { Extension } from '@codemirror/state'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { isValidTeXFile } from '../../../main/is-valid-tex-file'
import { getFileExtension } from './file'

const visualEditorProviders = importOverleafModules('visualEditorProviders')
const cmVisualEditorProviders: Array<{
  import: {
    getExtensions: (ext: string) => Extension
    id?: string
    defaultVisual?: boolean
  }
}> = importOverleafModules('sourceEditorVisualExtensions')

/**
 * Find the visual editor provider (if any) that claims a file, so that
 * per-file-type metadata such as the storage key id and default mode can be
 * read from it.
 */
function getVisualEditorProvider(
  filename: string
): { id?: string; defaultVisual?: boolean } | null {
  // Module-provided visual editors that render their own component (e.g. .bib)
  for (const provider of visualEditorProviders) {
    if (provider.import.isVisualEditorAvailable(filename)) {
      return provider.import
    }
  }

  // CodeMirror-extension based visual editors (e.g. markdown)
  const extension = getFileExtension(filename)
  if (extension !== null) {
    for (const provider of cmVisualEditorProviders) {
      const result = provider.import.getExtensions(extension)
      const extensions = Array.isArray(result) ? result : [result]
      if (extensions.length > 0) {
        return provider.import
      }
    }
  }

  return null
}

/**
 * This currently covers LaTeX and Markdown. Other file
 * types (e.g. .bib) use module-provided visual editors that render their own
 * component instead, so they must NOT enable the CodeMirror visual extensions.
 */
export function isCmVisualEditorAvailable(filename: string): boolean {
  if (isValidTeXFile(filename)) {
    return true
  }

  const extension = getFileExtension(filename)
  if (extension === null) {
    return false
  }

  for (const provider of cmVisualEditorProviders) {
    const result = provider.import.getExtensions(extension)
    const extensions = Array.isArray(result) ? result : [result]
    if (extensions.length > 0) {
      return true
    }
  }
  return false
}

/**
 * Whether any visual editor exists for the file, including module-provided
 * ones. Drives the editor toggle UI and the default editor mode for a file.
 */
export function isVisualEditorAvailable(filename: string): boolean {
  if (isCmVisualEditorAvailable(filename)) {
    return true
  }

  // Visual editors provided by modules
  for (const provider of visualEditorProviders) {
    if (provider.import.isVisualEditorAvailable(filename)) {
      return true
    }
  }
  return false
}

export function getVisualEditorComponent(filename: string) {
  for (const provider of visualEditorProviders) {
    const component = provider.import.getVisualEditorComponent(filename)
    if (component != null) {
      return component
    }
  }
  return null
}

export function getVisualEditorStorageKey(filename: string): string {
  const id = getVisualEditorProvider(filename)?.id
  return id != null ? `editor.lastUsedMode.${id}` : 'editor.lastUsedMode'
}

export function getVisualEditorDefault(filename: string): boolean {
  return getVisualEditorProvider(filename)?.defaultVisual ?? false
}
