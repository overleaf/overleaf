import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { isValidTeXFile } from '../../../main/is-valid-tex-file'

const visualEditorProviders = importOverleafModules('visualEditorProviders')
const cmVisualEditorProviders = importOverleafModules(
  'sourceEditorVisualExtensions'
)

/**
 * This currently covers LaTeX and Markdown. Other file
 * types (e.g. .bib) use module-provided visual editors that render their own
 * component instead, so they must NOT enable the CodeMirror visual extensions.
 */
export function isCmVisualEditorAvailable(filename: string): boolean {
  if (isValidTeXFile(filename)) {
    return true
  }

  for (const provider of cmVisualEditorProviders) {
    if (provider.import.isCmVisualEditorFile?.(filename)) {
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
  for (const provider of visualEditorProviders) {
    if (provider.import.isVisualEditorAvailable(filename)) {
      const id = provider.import.id
      return id != null ? `editor.lastUsedMode.${id}` : 'editor.lastUsedMode'
    }
  }
  return 'editor.lastUsedMode'
}
