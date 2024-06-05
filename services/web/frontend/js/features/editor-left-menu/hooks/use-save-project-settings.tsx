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

        // rootDocId is used in our tsx and our endpoint, but rootDoc_id is used in our project $scope, etc
        // as we use both namings in many files, and convert back and forth,
        // its complicated to seperate and choose one name for all usages
        // todo: make rootDocId or rootDoc_id consistent, and remove need for this/ other conversions
        const settingsKey = key === 'rootDocId' ? 'rootDoc_id' : key
        setProjectSettings({ ...projectSettings, [settingsKey]: newSetting })
      }
    }
  }
}
