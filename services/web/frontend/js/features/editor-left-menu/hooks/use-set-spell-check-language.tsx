import { useCallback } from 'react'
import { sendMB } from '../../../infrastructure/event-tracking'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { saveProjectSettings, saveUserSettings } from '../utils/api'

export default function useSetSpellCheckLanguage() {
  const [spellCheckLanguageScope, setSpellCheckLanguageScope] =
    useScopeValue<string>('project.spellCheckLanguage')
  const { _id: projectId } = useProjectContext()

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: string) => {
      const allowUpdate =
        spellCheckLanguage && spellCheckLanguage !== spellCheckLanguageScope

      if (allowUpdate) {
        sendMB('setting-changed', {
          changedSetting: 'spellCheckLanguage',
          changedSettingVal: spellCheckLanguage,
        })

        setSpellCheckLanguageScope(spellCheckLanguage)

        // save to both project setting and user setting
        saveProjectSettings({ projectId, spellCheckLanguage })
        saveUserSettings({ spellCheckLanguage })
      }
    },
    [projectId, setSpellCheckLanguageScope, spellCheckLanguageScope]
  )

  return setSpellCheckLanguage
}
