import { useFeatureFlag } from '@/shared/context/split-test-context'

export const useSurveyUrl = () => {
  const newErrorlogs = useFeatureFlag('new-editor-error-logs-redesign')
  if (newErrorlogs) {
    return 'https://forms.gle/83QJ9ALJkiugxTZf8'
  }
  return 'https://forms.gle/soyVStc5qDx9na1Z6'
}
