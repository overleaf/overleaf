import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import {
  CommentId,
  ReviewPanelCommentThreadMessage,
  ThreadId,
} from '../../../../../types/review-panel/review-panel'
import { ReviewPanelCommentThread } from '../../../../../types/review-panel/comment-thread'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { UserId } from '../../../../../types/user'
import { deleteJSON, getJSON, postJSON } from '@/infrastructure/fetch-json'
import RangesTracker from '@overleaf/ranges-tracker'
import { CommentOperation } from '../../../../../types/change'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorContext } from '@/shared/context/editor-context'
import { debugConsole } from '@/utils/debugging'
import { captureException } from '@/infrastructure/error-reporter'
import {
  AddCommentOperation,
  DeleteCommentOperation,
  SetCommentStateOperation,
} from 'overleaf-editor-core'
import Range from 'overleaf-editor-core/lib/range'
import { trackedDeletesFromState } from '@/features/source-editor/utils/tracked-deletes'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'
import { rangesUpdatedEffect } from '@/features/source-editor/extensions/history-ot'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useReviewPanelViewContext } from './review-panel-view-context'

export type Threads = Record<ThreadId, ReviewPanelCommentThread>

export const ThreadsContext = createContext<Threads | undefined>(undefined)

type ThreadsActions = {
  addComment: (pos: number, text: string, content: string) => Promise<void>
  resolveThread: (threadId: ThreadId) => Promise<void>
  reopenThread: (threadId: ThreadId) => Promise<void>
  deleteThread: (threadId: ThreadId) => Promise<void>
  addMessage: (threadId: ThreadId, content: string) => Promise<void>
  editMessage: (
    threadId: ThreadId,
    commentId: CommentId,
    content: string
  ) => Promise<void>
  deleteMessage: (threadId: ThreadId, commentId: CommentId) => Promise<void>
  deleteOwnMessage: (threadId: ThreadId, commentId: CommentId) => Promise<void>
}

const ThreadsActionsContext = createContext<ThreadsActions | undefined>(
  undefined
)

export const ThreadsProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const { projectId } = useProjectContext()
  const { currentDocument } = useEditorOpenDocContext()
  const { isRestrictedTokenMember } = useEditorContext()
  const view = useCodeMirrorViewContext()
  const { sendEvent } = useEditorAnalytics()
  const reviewPanelView = useReviewPanelViewContext()

  // const [error, setError] = useState<Error>()
  const [data, setData] = useState<Threads>()

  const isHistoryOT = currentDocument?.isHistoryOT()

  // load the initial threads data
  useEffect(() => {
    if (isRestrictedTokenMember) {
      return
    }

    const abortController = new AbortController()

    getJSON(`/project/${projectId}/threads`, {
      signal: abortController.signal,
    })
      .then(data => {
        setData(data)
      })
      .catch(error => {
        debugConsole.error(error)
        captureException(error)
        // setError(error)
      })
  }, [projectId, isRestrictedTokenMember])

  const { socket } = useConnectionContext()

  useSocketListener(
    socket,
    'new-comment',
    useCallback(
      (
        threadId: ThreadId,
        comment: ReviewPanelCommentThreadMessage & { timestamp: number }
      ) => {
        setData(value => {
          if (value) {
            const { submitting: _submitting, ...thread } = value[threadId] ?? {
              messages: [],
            }

            return {
              ...value,
              [threadId]: {
                ...thread,
                messages: [
                  ...thread.messages,
                  {
                    ...comment,
                    user: comment.user, // TODO
                    timestamp: new Date(comment.timestamp),
                  },
                ],
              },
            }
          }
        })
      },
      []
    )
  )

  useSocketListener(
    socket,
    'edit-message',
    useCallback((threadId: ThreadId, commentId: CommentId, content: string) => {
      setData(value => {
        if (value) {
          const thread = value[threadId] ?? { messages: [] }

          return {
            ...value,
            [threadId]: {
              ...thread,
              messages: thread.messages.map(message =>
                message.id === commentId ? { ...message, content } : message
              ),
            },
          }
        }
      })
    }, [])
  )

  useSocketListener(
    socket,
    'delete-message',
    useCallback((threadId: ThreadId, commentId: CommentId) => {
      setData(value => {
        if (value) {
          const thread = value[threadId] ?? { messages: [] }

          return {
            ...value,
            [threadId]: {
              ...thread,
              messages: thread.messages.filter(
                message => message.id !== commentId
              ),
            },
          }
        }
      })
    }, [])
  )

  useSocketListener(
    socket,
    'resolve-thread',
    useCallback(
      (
        threadId: ThreadId,
        user: { email: string; first_name: string; id: UserId }
      ) => {
        setData(value => {
          if (value) {
            const thread = value[threadId] ?? { messages: [] }

            return {
              ...value,
              [threadId]: {
                ...thread,
                resolved: true,
                resolved_by_user: user, // TODO
                resolved_at: new Date().toISOString(),
              },
            }
          }
        })
      },
      []
    )
  )

  useSocketListener(
    socket,
    'reopen-thread',
    useCallback((threadId: ThreadId) => {
      setData(value => {
        if (value) {
          const thread = value[threadId] ?? { messages: [] }

          return {
            ...value,
            [threadId]: {
              ...thread,
              resolved: undefined,
              resolved_by_user: undefined,
              resolved_at: undefined,
            },
          }
        }
      })
    }, [])
  )

  useSocketListener(
    socket,
    'delete-thread',
    useCallback((threadId: ThreadId) => {
      setData(value => {
        if (value) {
          const _value = { ...value }
          delete _value[threadId]
          return _value
        }
      })
    }, [])
  )

  useSocketListener(
    socket,
    'new-comment-threads',
    useCallback((threads: any) => {
      setData(prevState => {
        const newThreads = { ...prevState }
        for (const threadId of Object.keys(threads)) {
          const thread = threads[threadId]
          const newThreadData: ReviewPanelCommentThread = {
            messages: [],
            resolved: thread.resolved,
            resolved_at: thread.resolved_at,
            resolved_by_user_id: thread.resolved_by_user_id,
            resolved_by_user: thread.resolved_by_user,
          }
          for (const message of thread.messages) {
            newThreadData.messages.push({
              ...message,
              timestamp: new Date(message.timestamp),
            })
          }
          newThreads[threadId as ThreadId] = newThreadData
        }
        return newThreads
      })
    }, [])
  )

  const actions = useMemo(() => {
    if (!currentDocument) {
      return
    }

    const actions = {
      async addComment(pos: number, text: string, content: string) {
        const threadId = RangesTracker.generateId() as ThreadId

        await postJSON(`/project/${projectId}/thread/${threadId}/messages`, {
          body: { content },
        })

        sendEvent('rp-new-comment', { size: content.length })

        const op: CommentOperation = {
          c: text,
          p: pos,
          t: threadId,
        }

        currentDocument.submitOp(op)
      },
      async resolveThread(threadId: string) {
        await postJSON(
          `/project/${projectId}/doc/${currentDocument.doc_id}/thread/${threadId}/resolve`
        )
        sendEvent('rp-comment-resolve', { view: reviewPanelView })
      },
      async reopenThread(threadId: string) {
        await postJSON(
          `/project/${projectId}/doc/${currentDocument.doc_id}/thread/${threadId}/reopen`
        )
        sendEvent('rp-comment-reopen')
      },
      async deleteThread(threadId: string) {
        await deleteJSON(
          `/project/${projectId}/doc/${currentDocument.doc_id}/thread/${threadId}`
        )
        currentDocument.ranges?.removeCommentId(threadId)
        sendEvent('rp-comment-delete')
      },
      async addMessage(threadId: ThreadId, content: string) {
        await postJSON(`/project/${projectId}/thread/${threadId}/messages`, {
          body: { content },
        })

        sendEvent('rp-comment-reply', {
          view: reviewPanelView,
          size: content.length,
          thread: threadId,
        })
      },
      async editMessage(
        threadId: ThreadId,
        commentId: CommentId,
        content: string
      ) {
        await postJSON(
          `/project/${projectId}/thread/${threadId}/messages/${commentId}/edit`,
          { body: { content } }
        )
      },
      async deleteMessage(threadId: ThreadId, commentId: CommentId) {
        await deleteJSON(
          `/project/${projectId}/thread/${threadId}/messages/${commentId}`
        )
      },
      async deleteOwnMessage(threadId: ThreadId, commentId: CommentId) {
        await deleteJSON(
          `/project/${projectId}/thread/${threadId}/own-messages/${commentId}`
        )
      },
    }

    if (isHistoryOT) {
      // TODO: dispatch on view instead?
      Object.assign(actions, {
        async addComment(pos: number, text: string, content: string) {
          const threadId = RangesTracker.generateId() as ThreadId // TODO

          await postJSON(`/project/${projectId}/thread/${threadId}/messages`, {
            body: { content },
          })

          sendEvent('rp-new-comment', { size: content.length })

          const trackedDeletes = trackedDeletesFromState(view.state)
          pos = trackedDeletes.toSnapshot(pos)
          const ranges = [new Range(pos, text.length)]
          const op = new AddCommentOperation(threadId, ranges)
          currentDocument.historyOTShareDoc.submitOp([op])
          view.dispatch({
            effects: rangesUpdatedEffect.of(null),
          })
        },
        async resolveThread(threadId: string) {
          const op = new SetCommentStateOperation(threadId, true)
          currentDocument.historyOTShareDoc.submitOp([op])
          sendEvent('rp-comment-resolve', { view: reviewPanelView })
          view.dispatch({
            effects: rangesUpdatedEffect.of(null),
          })
        },
        async reopenThread(threadId: string) {
          const op = new SetCommentStateOperation(threadId, false)
          currentDocument.historyOTShareDoc.submitOp([op])
          sendEvent('rp-comment-reopen')
          view.dispatch({
            effects: rangesUpdatedEffect.of(null),
          })
        },
        async deleteThread(threadId: string) {
          const op = new DeleteCommentOperation(threadId)
          currentDocument.historyOTShareDoc.submitOp([op])
          sendEvent('rp-comment-delete')
          view.dispatch({
            effects: rangesUpdatedEffect.of(null),
          })
        },
      })
    }

    return actions
  }, [
    view,
    reviewPanelView,
    currentDocument,
    projectId,
    isHistoryOT,
    sendEvent,
  ])

  if (!actions) {
    return null
  }

  return (
    <ThreadsActionsContext.Provider value={actions}>
      <ThreadsContext.Provider value={data}>{children}</ThreadsContext.Provider>
    </ThreadsActionsContext.Provider>
  )
}

export const useThreadsContext = () => {
  return useContext(ThreadsContext)
}

export const useThreadsActionsContext = () => {
  const context = useContext(ThreadsActionsContext)
  if (!context) {
    throw new Error(
      'useThreadsActionsContext is only available inside ThreadsProvider'
    )
  }
  return context
}
