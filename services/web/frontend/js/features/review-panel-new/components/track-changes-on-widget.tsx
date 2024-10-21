import { Trans } from 'react-i18next'
import { EditorView } from '@codemirror/view'
import classnames from 'classnames'
import { useCodeMirrorStateContext } from '@/features/source-editor/components/codemirror-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'

function TrackChangesOnWidget() {
  const { setReviewPanelOpen } = useLayoutContext()
  const state = useCodeMirrorStateContext()
  const darkTheme = state.facet(EditorView.darkTheme)

  const openReviewPanel = useCallback(() => {
    setReviewPanelOpen(true)
  }, [setReviewPanelOpen])

  return (
    <div className="review-panel-in-editor-widgets">
      <div className="review-panel-in-editor-widgets-inner">
        <button
          className={classnames('review-panel-track-changes-indicator', {
            'review-panel-track-changes-indicator-on-dark': darkTheme,
          })}
          onClick={openReviewPanel}
        >
          <Trans
            i18nKey="track_changes_is_on"
            components={{ strong: <strong /> }}
          />
        </button>
      </div>
    </div>
  )
}

export default TrackChangesOnWidget
