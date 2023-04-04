import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from 'react-bootstrap'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import {
  hasSeenCM6SwitchAwaySurvey,
  setHasSeenCM6SwitchAwaySurvey,
} from '../utils/switch-away-survey'
import { sendMB } from '../../../infrastructure/event-tracking'

type CM6SwitchAwaySurveyState = 'disabled' | 'enabled' | 'shown'

export default function CM6SwitchAwaySurvey() {
  const [state, setState] = useState<CM6SwitchAwaySurveyState>('disabled')
  const [newSourceEditor] = useScopeValue('editor.newSourceEditor')
  const [richText] = useScopeValue('editor.showRichText')
  const initialRichTextPreference = useRef<boolean>(richText)

  useEffect(() => {
    // If the user has previously seen any switch-away survey, then don't show
    // the current one
    if (hasSeenCM6SwitchAwaySurvey()) return

    if (initialRichTextPreference.current) {
      if (!richText && newSourceEditor) {
        // If user change from rich text to cm6, we remove the rich text
        // preference so if user use rich text -> cm6 -> ace, we will show the
        // current survey
        initialRichTextPreference.current = false
      }

      // If the user loaded rich text initially, then don't show the survey
      // (we are assuming that they will not have used CM6 as much)
      return
    }

    if (!newSourceEditor && !richText) {
      setState('enabled')
    } else {
      setState('disabled')
    }
  }, [newSourceEditor, richText])

  useEffect(() => {
    const handleKeyDown = () => {
      const TIME_FOR_SURVEY_TO_APPEAR = 3000

      setTimeout(() => {
        if (state === 'enabled') {
          setState('shown')
          setHasSeenCM6SwitchAwaySurvey()
        }
      }, TIME_FOR_SURVEY_TO_APPEAR)
    }

    // can't access the ace editor directly, so add the keydown event
    // to window
    window?.addEventListener('keydown', handleKeyDown, { once: true })

    return () => window?.removeEventListener('keydown', handleKeyDown)
  }, [state])

  const handleClose = useCallback(() => {
    setState('disabled')
  }, [])

  const handleFollowLink = useCallback(() => {
    sendMB('cm6-switch-away-survey')
    setState('disabled')
  }, [])

  if (state !== 'shown') {
    return null
  }

  return (
    <div className="alert alert-success cm6-switch-away-survey" role="alert">
      <Button
        className="close"
        data-dismiss="alert"
        aria-label="Close"
        onClick={handleClose}
        bsStyle={null}
      >
        <span aria-hidden="true">&times;</span>
      </Button>
      <div className="warning-content">
        <div>
          <div className="warning-text">
            We noticed that you're still using the{' '}
            <strong>Source (legacy)</strong> editor.
          </div>
          <div className="warning-text">Could you let us know why?</div>
        </div>
        <div style={{ display: 'inline-flex' }}>
          <a
            href="https://forms.gle/Ygv8gLZ4N8LepQj56"
            className="btn btn-sm btn-info"
            target="_blank"
            rel="noreferrer"
            onClick={handleFollowLink}
          >
            Take survey
          </a>
        </div>
      </div>
    </div>
  )
}
