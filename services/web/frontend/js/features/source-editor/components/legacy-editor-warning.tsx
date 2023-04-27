import { memo, useCallback, useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import customLocalStorage from '../../../infrastructure/local-storage'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import * as eventTracking from '../../../infrastructure/event-tracking'

export const LegacyEditorWarning = memo(function LegacyEditorWarning({
  delay,
}: {
  delay: number
}) {
  const [show, setShow] = useState(false)
  const [newSourceEditor] = useScopeValue('editor.newSourceEditor')
  const hasDismissedLegacyEditor = customLocalStorage.getItem(
    'editor.has_dismissed_legacy_editor_warning'
  )

  useEffect(() => {
    const showLegacyEditor =
      !hasDismissedLegacyEditor && newSourceEditor === false

    let timeoutId: number | undefined

    if (showLegacyEditor) {
      timeoutId = window.setTimeout(() => {
        eventTracking.sendMB('legacy-editor-warning-prompt')
        setShow(true)
      }, delay)
    }

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasDismissedLegacyEditor, newSourceEditor, delay])

  const handleClose = useCallback(() => {
    setShow(false)
    customLocalStorage.setItem(
      'editor.has_dismissed_legacy_editor_warning',
      true
    )
    eventTracking.sendMB('legacy-editor-warning-dismiss')
  }, [])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('legacy-editor-warning-link-click')
  }, [])

  if (!show) {
    return null
  }

  return (
    <div className="alert alert-info legacy-editor-warning" role="alert">
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
        <div>We're retiring our Source (legacy) editor in late May 2023.</div>
        <div>
          <a
            className="warning-link"
            href="https://www.overleaf.com/blog/were-retiring-our-legacy-source-editor"
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
          >
            Read the blog post
          </a>{' '}
          to learn more and find out how to report any problems.
        </div>
      </div>
    </div>
  )
})
