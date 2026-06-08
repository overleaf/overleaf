import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export const useAreTabsEnabled = () => {
  const { editorTabs } = useProjectSettingsContext()
  const featureFlag = useFeatureFlag('editor-tabs')
  return featureFlag && Boolean(editorTabs)
}
