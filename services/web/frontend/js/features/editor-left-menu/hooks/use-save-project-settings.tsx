import { type ProjectSettings, saveProjectSettings } from '../utils/api'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'

export default function useSaveProjectSettings() {
  // projectSettings value will be undefined on mount
  const [projectSettings, setProjectSettings] = useScopeValue<
    ProjectSettings | undefined
  >('project')
  const { _id: projectId } = useProjectContext()

  return async (
    key: keyof ProjectSettings,
    newSetting: ProjectSettings[keyof ProjectSettings]
  ) => {
    if (projectSettings) {
      const currentSetting = projectSettings[key]
      if (currentSetting !== newSetting) {
        await saveProjectSettings(projectId, {
          [key]: newSetting,
        })
        setProjectSettings({ ...projectSettings, [key]: newSetting })
      }
    }
  }
}
