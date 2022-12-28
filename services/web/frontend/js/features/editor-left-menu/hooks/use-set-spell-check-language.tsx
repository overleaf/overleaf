import { useCallback } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { saveProjectSettings, saveUserSettings } from '../utils/api'

export default function useSetSpellCheckLanguage() {
  const [spellCheckLanguageScope, setSpellCheckLanguageScope] =
    useScopeValue<string>('project.spellCheckLanguage')
  const { _id: projectId } = useProjectContext()

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: string) => {
      if (spellCheckLanguageScope) {
        setSpellCheckLanguageScope(spellCheckLanguage)

        // save to both project setting and user setting
        saveProjectSettings(projectId, { spellCheckLanguage })
        saveUserSettings({ spellCheckLanguage })
      }
    },
    [projectId, setSpellCheckLanguageScope, spellCheckLanguageScope]
  )

  return setSpellCheckLanguage
}
