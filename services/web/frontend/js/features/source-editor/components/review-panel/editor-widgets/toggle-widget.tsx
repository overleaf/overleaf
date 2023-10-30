import { Trans } from 'react-i18next'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { useCodeMirrorStateContext } from '../../codemirror-editor'
import { EditorView } from '@codemirror/view'
import classnames from 'classnames'

function ToggleWidget() {
  const { toggleReviewPanel } = useReviewPanelUpdaterFnsContext()
  const state = useCodeMirrorStateContext()
  const darkTheme = state.facet(EditorView.darkTheme)

  return (
    <button
      className={classnames('rp-track-changes-indicator', {
        'rp-track-changes-indicator-on-dark': darkTheme,
      })}
      onClick={toggleReviewPanel}
    >
      <Trans
        i18nKey="track_changes_is_on"
        components={{ strong: <strong /> }}
      />
    </button>
  )
}

export default ToggleWidget
