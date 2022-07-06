import { memo, useEffect, useRef, useState } from 'react'
import { Button, Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import { sendMB } from '../../../infrastructure/event-tracking'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useProjectContext } from '../../../shared/context/project-context'

const SAY_THANKS_TIMEOUT = 10 * 1000

function FasterCompilesFeedbackContent() {
  const { clsiServerId, deliveryLatencies, pdfFile, pdfUrl } =
    useCompileContext()
  const { _id: projectId } = useProjectContext()

  const [incrementalCompiles, setIncrementalCompiles] = useState(0)
  const [hasRatedProject, setHasRatedProject] = usePersistedState(
    `faster-compiles-feedback:${projectId}`,
    false,
    true
  )
  const [dismiss, setDismiss] = usePersistedState(
    'faster-compiles-feedback:dismiss',
    false,
    true
  )
  const [sayThanks, setSayThanks] = useState(false)
  const lastClsiServerId = useRef('')
  const lastPdfUrl = useRef('')

  useEffect(() => {
    if (
      !pdfUrl ||
      !lastPdfUrl.current ||
      clsiServerId !== lastClsiServerId.current
    ) {
      // Reset history after
      // - clearing cache / server error (both reset pdfUrl)
      // - initial compile after reset of pdfUrl
      // - switching the clsi server, aka we get a _slow_ full compile.
      setIncrementalCompiles(0)
      lastClsiServerId.current = clsiServerId
    } else {
      setIncrementalCompiles(n => n + 1)
    }
    lastPdfUrl.current = pdfUrl
  }, [clsiServerId, lastPdfUrl, pdfUrl, setIncrementalCompiles])

  function submitFeedback(feedback = '') {
    sendMB('faster-compiles-feedback', {
      projectId,
      server: clsiServerId?.includes('-c2d-') ? 'faster' : 'normal',
      feedback,
      pdfSize: pdfFile.size,
      ...deliveryLatencies,
    })
    setHasRatedProject(true)
    setSayThanks(true)
    window.setTimeout(() => {
      setSayThanks(false)
    }, SAY_THANKS_TIMEOUT)
  }

  function dismissFeedback() {
    sendMB('faster-compiles-feedback-dismiss')
    setDismiss(true)
  }

  const { t } = useTranslation()

  // Hide the feedback prompt in all these cases:
  // - the initial compile (0), its always perceived as _slow_.
  // - the first incremental compile (1), its always _faster_ than ^.
  // - the user has dismissed the prompt
  // - the user has rated compile speed already (say thanks if needed)
  switch (true) {
    case sayThanks:
      return (
        <Alert
          bsStyle="info"
          className="faster-compiles-feedback"
          onClick={() => setSayThanks(false)}
        >
          {t('faster_compiles_feedback_thanks')}
        </Alert>
      )
    case dismiss || hasRatedProject:
      return null
    case incrementalCompiles > 1:
      return (
        <Alert bsStyle="info" className="faster-compiles-feedback">
          <button
            type="button"
            aria-label={t('dismiss')}
            className="btn-inline-link faster-compiles-feedback-dismiss"
            onClick={dismissFeedback}
          >
            <Icon type="close" fw />
          </button>
          {t('faster_compiles_feedback_question')}
          <div className="faster-compiles-feedback-options">
            {['slower', 'same', 'faster'].map(feedback => (
              <Button
                bsStyle="default"
                bsSize="xs"
                className="faster-compiles-feedback-option"
                onClick={() => submitFeedback(feedback)}
                key={feedback}
              >
                {feedback === 'faster'
                  ? t('faster_compiles_feedback_seems_faster')
                  : feedback === 'same'
                  ? t('faster_compiles_feedback_seems_same')
                  : t('faster_compiles_feedback_seems_slower')}
              </Button>
            ))}
          </div>
        </Alert>
      )
    default:
      return null
  }
}

function FasterCompilesFeedback() {
  const { showFasterCompilesFeedbackUI } = useCompileContext()

  if (!showFasterCompilesFeedbackUI) {
    return null
  }
  return <FasterCompilesFeedbackContent />
}

export default memo(FasterCompilesFeedback)
