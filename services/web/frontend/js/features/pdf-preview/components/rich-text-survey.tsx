import { FC, memo, useCallback, useEffect, useState } from 'react'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { RichTextSurveyInner } from './rich-text-survey-inner'

const SURVEY_URL = 'https://forms.gle/sS4BsUz38GMc81it5'
const DEFAULT_DELAY = 10 * 1000 // 10 seconds

const RichTextSurvey: FC<{ delay?: number }> = ({ delay = DEFAULT_DELAY }) => {
  const [dismissed, setDismissed] = usePersistedState(
    'rich-text-survey-dismissed',
    false,
    true
  )

  const [display, setDisplay] = useState(false)

  const [showRichText] = useScopeValue('editor.showRichText')

  useEffect(() => {
    let timer: number | undefined

    if (showRichText) {
      timer = window.setTimeout(() => {
        setDisplay(true)
      }, delay)
    }

    return () => {
      window.clearTimeout(timer)
    }
  }, [showRichText, delay])

  const handleDismiss = useCallback(
    event => {
      event.preventDefault()
      setDismissed(true)
    },
    [setDismissed]
  )

  const openSurvey = useCallback(() => {
    window.open(SURVEY_URL, '_blank')
    setDismissed(true)
  }, [setDismissed])

  if (dismissed || !display) {
    return null
  }

  return (
    <RichTextSurveyInner
      handleDismiss={handleDismiss}
      openSurvey={openSurvey}
    />
  )
}

export default memo(RichTextSurvey)
