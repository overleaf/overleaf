import { FormEventHandler, useCallback, useState, useRef, memo } from 'react'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { EditorSelection } from '@codemirror/state'
import { useTranslation } from 'react-i18next'
import { useThreadsActionsContext } from '../context/threads-context'
import { removeNewCommentRangeEffect } from '@/features/source-editor/extensions/add-comment'
import { ReviewPanelEntry } from './review-panel-entry'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/shared/components/ol/ol-button'
import {
  MentionsInput,
  MentionsInputHandle,
} from '@/shared/components/mentions-input'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export const ReviewPanelAddComment = memo<{
  docId: string
  from: number
  to: number
  threadId: string
  top: number | undefined
}>(function ReviewPanelAddComment({ from, to, threadId, top, docId }) {
  const { t } = useTranslation()
  const commentMentionsEnabled = useFeatureFlag('comment-mentions')
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { addComment } = useThreadsActionsContext()
  const [submitting, setSubmitting] = useState(false)
  const { showGenericMessageModal } = useModalsContext()
  const [content, setContent] = useState('')

  const handleClose = useCallback(() => {
    view.dispatch({
      effects: removeNewCommentRangeEffect.of(threadId),
    })
  }, [view, threadId])

  const submitForm = useCallback(
    async (commentContent: string) => {
      if (commentContent.trim().length === 0) {
        return
      }

      setSubmitting(true)

      const text = view.state.sliceDoc(from, to)

      try {
        await addComment(from, text, commentContent)
        handleClose()
        view.dispatch({
          selection: EditorSelection.cursor(view.state.selection.main.anchor),
        })
      } catch (err) {
        debugConsole.error(err)
        showGenericMessageModal(
          t('add_comment_error_title'),
          t('add_comment_error_message')
        )
      }
      setSubmitting(false)
    },
    [view, from, to, addComment, handleClose, showGenericMessageModal, t]
  )

  const handleBlur = useCallback(() => {
    if (content === '') {
      window.setTimeout(() => {
        handleClose()
      })
    }
  }, [content, handleClose])

  const handleSubmit = useCallback<FormEventHandler>(
    event => {
      event.preventDefault()
      submitForm(content)
    },
    [submitForm, content]
  )

  // We only ever want to focus the element once
  const hasBeenFocused = useRef(false)
  const commentInputRef = useRef<MentionsInputHandle | null>(null)

  // Auto-focus the input once the element has been correctly positioned.
  // We cannot use the autofocus attribute as we need to wait until the parent element
  // has been positioned (with the "top" attribute) to avoid scrolling to the initial
  // position of the element
  const observerCallback = useCallback((mutationList: MutationRecord[]) => {
    if (hasBeenFocused.current) {
      return
    }

    for (const mutation of mutationList) {
      const target = mutation.target as HTMLElement
      if (target.style.top) {
        if (commentInputRef.current?.focus()) {
          hasBeenFocused.current = true
        }
      }
    }
  }, [])

  const observerRef = useRef<MutationObserver | null>(null)

  const handleElement = useCallback(
    (element: HTMLElement | null) => {
      if (element) {
        element.dispatchEvent(new Event('review-panel:position'))

        observerRef.current = new MutationObserver(observerCallback)
        const entryWrapper = element.closest('.review-panel-entry')
        if (entryWrapper) {
          observerRef.current.observe(entryWrapper, {
            attributes: true,
            attributeFilter: ['style'],
          })
        }
      } else {
        // [TODO React 19] return a cleanup function instead of using null element
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
      }
    },
    [observerCallback]
  )

  return (
    <ReviewPanelEntry
      docId={docId}
      top={top}
      position={from}
      op={{
        p: from,
        c: state.sliceDoc(from, to),
        t: threadId as ThreadId,
      }}
      selectLineOnFocus={false}
      disabled={submitting}
    >
      <form
        className="review-panel-entry-content"
        onBlur={handleBlur}
        onSubmit={handleSubmit}
        ref={handleElement}
      >
        <MentionsInput
          ref={commentInputRef}
          className="review-panel-add-comment-editor"
          onChange={setContent}
          onSubmit={submitForm}
          placeholder={
            commentMentionsEnabled
              ? t('comment_or_mention_someone')
              : t('add_your_comment_here')
          }
          disabled={submitting}
        />
        <div className="review-panel-add-comment-buttons">
          <OLButton
            variant="ghost"
            size="sm"
            className="review-panel-add-comment-cancel-button"
            disabled={submitting}
            onClick={handleClose}
          >
            {t('cancel')}
          </OLButton>
          <OLButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={content === '' || submitting}
          >
            {t('comment')}
          </OLButton>
        </div>
      </form>
    </ReviewPanelEntry>
  )
})
