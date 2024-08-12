import React, { FC, useMemo, useRef, useState } from 'react'
import { Overlay, Popover } from 'react-bootstrap'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-editor'
import {
  useThreadsActionsContext,
  useThreadsContext,
} from '../context/threads-context'
import { useTranslation } from 'react-i18next'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import Icon from '@/shared/components/icon'

export const ReviewPanelResolvedThreads: FC = () => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const threads = useThreadsContext()
  const { reopenThread, deleteThread } = useThreadsActionsContext()

  const [expanded, setExpanded] = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolvedThreads = useMemo(() => {
    if (!threads) {
      return []
    }

    const resolvedThreads = []
    for (const [id, thread] of Object.entries(threads)) {
      if (thread.resolved) {
        resolvedThreads.push({ ...thread, id })
      }
    }
    return resolvedThreads
  }, [threads])

  return (
    <>
      <button
        className="resolved-comments-toggle"
        ref={buttonRef}
        onClick={() => setExpanded(true)}
      >
        <Icon type="inbox" fw />
      </button>

      {expanded && (
        <Overlay
          show
          onHide={() => setExpanded(false)}
          animation={false}
          container={view.scrollDOM}
          containerPadding={0}
          placement="bottom"
          rootClose
          target={buttonRef.current ?? undefined}
        >
          <Popover id="popover-resolved-threads">
            {resolvedThreads.length ? (
              <div className="resolved-comments">
                {resolvedThreads.map(thread => (
                  <div key={thread.id}>
                    <div>{thread.resolved_at}</div>
                    <div>
                      <button
                        onClick={() => reopenThread(thread.id as ThreadId)}
                      >
                        {t('reopen')}
                      </button>
                      <button
                        onClick={() => deleteThread(thread.id as ThreadId)}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>{t('no_resolved_threads')}</div>
            )}
          </Popover>
        </Overlay>
      )}
    </>
  )
}
