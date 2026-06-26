import { type ProjectSettings, saveProjectSettings } from '../utils/api'
import { useProjectContext } from '@/shared/context/project-context'

export default function useSaveProjectSettings() {
  const { projectId, project, updateProject } = useProjectContext()

  return async (
    key: keyof ProjectSettings,
    newSetting: ProjectSettings[keyof ProjectSettings]
  ) => {
    if (project) {
      const currentSetting = project[key]
      if (currentSetting !== newSetting) {
        await saveProjectSettings(projectId, {
          [key]: newSetting,
        })

        updateProject({ [key]: newSetting })
      }
    }
  }
}
