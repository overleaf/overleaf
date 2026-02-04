import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { isValidTeXFile } from '../../../main/is-valid-tex-file'

const visualEditorProviders = importOverleafModules('visualEditorProviders')

export function isVisualEditorAvailable(filename: string): boolean {
  // Core LaTeX visual editor
  if (isValidTeXFile(filename)) {
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
