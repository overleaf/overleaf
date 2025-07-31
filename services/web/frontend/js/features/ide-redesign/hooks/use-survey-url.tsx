import {
  useFeatureFlag,
  useSplitTest,
} from '@/shared/context/split-test-context'
import { isNewEditorInBeta } from '../utils/new-editor-utils'

export const useSurveyUrl = () => {
  const newErrorlogs = useFeatureFlag('new-editor-error-logs-redesign')
  const splitTestConfig = useSplitTest('editor-redesign')
  const newEditorBeta = isNewEditorInBeta()

  if (newEditorBeta) {
    return (
      splitTestConfig.info?.badgeInfo?.url ||
      'https://forms.gle/NGkALNUiMbanjp3Q7'
    )
  }

  if (newErrorlogs) {
    return 'https://forms.gle/83QJ9ALJkiugxTZf8'
  }
  return 'https://forms.gle/soyVStc5qDx9na1Z6'
}
