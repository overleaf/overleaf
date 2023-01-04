import { useCallback } from 'react'
import { sendMB } from '../../../infrastructure/event-tracking'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import {
  type ProjectSettings,
  saveProjectSettings,
  saveUserSettings,
} from '../utils/api'

export default function useSetSpellCheckLanguage() {
  const [spellCheckLanguage, setSpellCheckLanguage] = useScopeValue<
    ProjectSettings['spellCheckLanguage']
  >('project.spellCheckLanguage')
  const { _id: projectId } = useProjectContext()

  return useCallback(
    (newSpellCheckLanguage: ProjectSettings['spellCheckLanguage']) => {
      const allowUpdate =
        newSpellCheckLanguage && newSpellCheckLanguage !== spellCheckLanguage

      if (allowUpdate) {
        sendMB('setting-changed', {
          changedSetting: 'spellCheckLanguage',
          changedSettingVal: newSpellCheckLanguage,
        })

        setSpellCheckLanguage(newSpellCheckLanguage)

        // save to both project setting and user setting
        saveProjectSettings({
          projectId,
          spellCheckLanguage: newSpellCheckLanguage,
        })
        saveUserSettings({ spellCheckLanguage: newSpellCheckLanguage })
      }
    },
    [projectId, setSpellCheckLanguage, spellCheckLanguage]
  )
}
