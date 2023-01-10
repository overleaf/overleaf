import { useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { type ProjectSettings, saveUserSettings } from '../utils/api'
import useSaveProjectSettings from './use-save-project-settings'

export default function useSetSpellCheckLanguage() {
  const [spellCheckLanguage, setSpellCheckLanguage] = useScopeValue<
    ProjectSettings['spellCheckLanguage']
  >('project.spellCheckLanguage')
  const saveProjectSettings = useSaveProjectSettings()

  return useCallback(
    (newSpellCheckLanguage: ProjectSettings['spellCheckLanguage']) => {
      const allowUpdate =
        spellCheckLanguage != null &&
        newSpellCheckLanguage !== spellCheckLanguage

      if (allowUpdate) {
        setSpellCheckLanguage(newSpellCheckLanguage)

        // Save project settings is created from hooks because it will save the value on
        // both server-side and client-side (angular scope)
        saveProjectSettings('spellCheckLanguage', newSpellCheckLanguage)

        // For user settings, we only need to save it on server-side,
        // so we import the function directly without hooks
        saveUserSettings('spellCheckLanguage', newSpellCheckLanguage)
      }
    },
    [setSpellCheckLanguage, spellCheckLanguage, saveProjectSettings]
  )
}
