import { useCallback, useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import { Nullable } from '../../../../../types/utils'
import customLocalStorage from '../../../infrastructure/local-storage'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import grammarlyExtensionPresent from '../../../shared/utils/grammarly'

type GrammarlyWarningProps = {
  delay: number
}

export default function GrammarlyWarning({ delay }: GrammarlyWarningProps) {
  const [show, setShow] = useState(false)
  const [newSourceEditor] = useScopeValue('editor.newSourceEditor')
  const [showRichText] = useScopeValue('editor.showRichText')
  const grammarly = grammarlyExtensionPresent()
  const hasDismissedGrammarlyWarning = customLocalStorage.getItem(
    'editor.has_dismissed_grammarly_warning'
  )

  useEffect(() => {
    const showGrammarlyWarning =
      !hasDismissedGrammarlyWarning &&
      grammarly &&
      newSourceEditor &&
      !showRichText

    let timeoutID: Nullable<number>

    if (showGrammarlyWarning) {
      const timeout = window.setTimeout(() => {
        setShow(true)
        timeoutID = null
      }, delay)

      timeoutID = timeout
    }

    return () => {
      if (timeoutID) {
        clearTimeout(timeoutID)
      }
    }
  }, [
    grammarly,
    hasDismissedGrammarlyWarning,
    newSourceEditor,
    showRichText,
    delay,
  ])

  const handleClose = useCallback(() => {
    setShow(false)
    customLocalStorage.setItem('editor.has_dismissed_grammarly_warning', true)
  }, [])

  if (!show) {
    return null
  }

  return (
    <div className="alert alert-info grammarly-warning" role="alert">
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
        A browser extension, for example Grammarly, may be slowing down
        Overleaf.{' '}
        <a
          className="warning-link"
          href="/learn/how-to/Use_Grammarly_with_Overleaf#Performance_issues"
          target="_blank"
        >
          Find out how to avoid this
        </a>
      </div>
    </div>
  )
}
