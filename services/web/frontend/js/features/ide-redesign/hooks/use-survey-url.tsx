import { useSplitTest } from '@/shared/context/split-test-context'

export const useSurveyUrl = () => {
  const splitTestConfig = useSplitTest('editor-redesign')

  return (
    splitTestConfig.info?.badgeInfo?.url ||
    'https://forms.gle/NGkALNUiMbanjp3Q7'
  )
}
