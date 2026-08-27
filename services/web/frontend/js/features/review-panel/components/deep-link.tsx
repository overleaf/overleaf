import { useCallback, useEffect, useRef } from 'react'
import { useDeepLinkContext } from '@/features/ide-react/context/deep-link-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useProjectContext } from '@/shared/context/project-context'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '../context/threads-context'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'

// how long to wait for a doc to restore its stored scroll position. The restore
// runs two ticks after the doc opens, so this only has to outlast a couple of
// frames. It doubles as the delay the user waits when the restore has already
// run and the event never arrives, so keep it short.
const SCROLL_RESTORE_TIMEOUT = 100

export default function DeepLink() {
  const {
    deepLinkedPanel,
    deepLinkedThreadId,
    deepLinkedChangeId,
    clearDeepLinkedChange,
    reportDeepLinkedThreadNotFound,
  } = useDeepLinkContext()
  const { features } = useProjectContext()
  const { currentDocumentId } = useEditorOpenDocContext()
  const ranges = useRangesContext()
  const threads = useThreadsContext()
  const view = useCodeMirrorViewContext()
  const { openReviewPanel } = useReviewPanelLayout()

  const scrolledRangeRef = useRef<string | null>(null)
  const pendingScrollsRef = useRef(new Set<() => void>())

  // the review panel only renders an entry for a range that the editor has
  // rendered, so scroll the deep-linked range into view first. Without this the
  // entry never mounts for a range below the initial viewport, and the panel
  // opens on nothing. Ranges rebuild on every edit, so only scroll once per id.
  const scrollRangeIntoView = useCallback(
    (id: string, position: number) => {
      if (scrolledRangeRef.current === id) {
        return
      }

      scrolledRangeRef.current = id

      const pendingScrolls = pendingScrollsRef.current

      const cancel = () => {
        window.clearTimeout(timer)
        window.removeEventListener('editor:scroll-position-restored', scroll)
        pendingScrolls.delete(cancel)
      }

      // set the cursor at the range without taking focus, so that the review
      // panel entry takes the focus once the panel has positioned it
      function scroll() {
        cancel()

        const selection = EditorSelection.cursor(
          Math.min(position, view.state.doc.length)
        )

        view.dispatch({
          selection,
          effects: EditorView.scrollIntoView(selection, { y: 'center' }),
        })
      }

      // a doc restores its stored scroll position two ticks after it opens,
      // which would drag the editor away from the range again, so wait for the
      // restore. It has already run when the doc was open before the range
      // resolved, so give up waiting after a short delay.
      const timer = window.setTimeout(scroll, SCROLL_RESTORE_TIMEOUT)
      window.addEventListener('editor:scroll-position-restored', scroll)

      pendingScrolls.add(cancel)
    },
    [view]
  )

  useEffect(() => {
    const pendingScrolls = pendingScrollsRef.current

    return () => {
      for (const cancel of Array.from(pendingScrolls)) {
        cancel()
      }
    }
  }, [])

  // without track changes the review panel is not rendered at all, and the
  // ranges and threads providers are absent, so every effect below no-ops

  useEffect(() => {
    if (deepLinkedPanel !== 'review-panel' || !features.trackChangesVisible) {
      return
    }

    openReviewPanel()
  }, [deepLinkedPanel, features.trackChangesVisible, openReviewPanel])

  useEffect(() => {
    if (!deepLinkedThreadId) {
      return
    }

    if (!features.trackChangesVisible) {
      reportDeepLinkedThreadNotFound()
      return
    }

    // ranges are only built for the currently open doc, so wait for the
    // deep-linked doc to finish opening before looking for the comment
    if (!threads || !ranges || ranges.docId !== currentDocumentId) {
      return
    }

    const comment = ranges.comments.find(
      ({ op }) => op.t === deepLinkedThreadId
    )
    const thread = threads[deepLinkedThreadId]

    if (!comment || !thread || thread.messages.length === 0) {
      reportDeepLinkedThreadNotFound()
      return
    }

    openReviewPanel()
    scrollRangeIntoView(deepLinkedThreadId, comment.op.p)

    // the review panel renders no entry for a resolved comment, so nothing
    // would select and nothing would explain why. Scroll to the comment anyway
    // so the panel shows the right part of the doc, then say it is not there.
    if (comment.resolved || thread.resolved) {
      reportDeepLinkedThreadNotFound()
    }
  }, [
    currentDocumentId,
    deepLinkedThreadId,
    features.trackChangesVisible,
    openReviewPanel,
    ranges,
    reportDeepLinkedThreadNotFound,
    scrollRangeIntoView,
    threads,
  ])

  useEffect(() => {
    if (!deepLinkedChangeId || !features.trackChangesVisible) {
      return
    }

    // ranges are only built for the currently open doc, so wait for the
    // deep-linked doc to finish opening before looking for the change
    if (!ranges || ranges.docId !== currentDocumentId) {
      return
    }

    openReviewPanel()

    // aggregated deletions stay in ranges.changes even when they are folded
    // into the preceding insert's entry visually, so a single lookup covers
    // both cases
    const change = ranges.changes.find(({ id }) => id === deepLinkedChangeId)

    if (!change) {
      // the change was accepted or rejected before the link was followed,
      // leave the review panel open and drop the pending id silently
      clearDeepLinkedChange()
      return
    }

    scrollRangeIntoView(deepLinkedChangeId, change.op.p)
  }, [
    clearDeepLinkedChange,
    currentDocumentId,
    deepLinkedChangeId,
    features.trackChangesVisible,
    openReviewPanel,
    ranges,
    scrollRangeIntoView,
  ])

  return null
}
