import { FC, FormEventHandler, useCallback, useState } from 'react'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import { EditorSelection } from '@codemirror/state'
import { PANEL_WIDTH } from './review-panel'
import { useTranslation } from 'react-i18next'
import { useThreadsActionsContext } from '../context/threads-context'

export const ReviewPanelAddComment: FC = () => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  // eslint-disable-next-line no-unused-vars
  const _state = useCodeMirrorStateContext()
  const { addComment } = useThreadsActionsContext()
  const [error, setError] = useState<Error>()
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = useCallback<FormEventHandler>(
    event => {
      event.preventDefault()

      const { from, to } = view.state.selection.main
      const content = view.state.sliceDoc(from, to)

      const formData = new FormData(event.target as HTMLFormElement)
      const message = formData.get('message') as string

      addComment(from, content, message).catch(setError)

      view.dispatch({
        selection: EditorSelection.cursor(view.state.selection.main.anchor),
      })
    },
    [addComment, view]
  )

  const handleElement = useCallback((element: HTMLElement | null) => {
    if (element) {
      element.dispatchEvent(new Event('review-panel:position'))
    }
  }, [])

  if (!showForm) {
    return <button onClick={() => setShowForm(true)}>{t('add_comment')}</button>
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', width: PANEL_WIDTH }}
      ref={handleElement}
    >
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <textarea name="message" rows={3} autoFocus />
      <button type="submit">{t('comment')}</button>
      {error && <div>{error.message}</div>}
    </form>
  )
}
