import { useCallback } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { type ProjectSettings, saveUserSettings } from '../utils/api'
import useSaveProjectSettings from './use-save-project-settings'

export default function useSetSpellCheckLanguage() {
  const { project } = useProjectContext()
  const spellCheckLanguage = project?.spellCheckLanguage
  const saveProjectSettings = useSaveProjectSettings()

  return useCallback(
    (newSpellCheckLanguage: ProjectSettings['spellCheckLanguage']) => {
      const allowUpdate =
        spellCheckLanguage != null &&
        newSpellCheckLanguage !== spellCheckLanguage

      if (allowUpdate) {
        // Save project settings is created from hooks because it will save the value on
        // both server-side and client-side (project context)
        saveProjectSettings('spellCheckLanguage', newSpellCheckLanguage)

        // For user settings, we only need to save it on server-side,
        // so we import the function directly without hooks
        saveUserSettings('spellCheckLanguage', newSpellCheckLanguage)
      }
    },
    [spellCheckLanguage, saveProjectSettings]
  )
}
