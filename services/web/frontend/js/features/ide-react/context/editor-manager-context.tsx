import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { sendMB } from '@/infrastructure/event-tracking'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { useIdeContext } from '@/shared/context/ide-context'
import { OpenDocuments } from '@/features/ide-react/editor/open-documents'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugConsole } from '@/utils/debugging'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { useLayoutContext } from '@/shared/context/layout-context'
import { GotoLineOptions } from '@/features/ide-react/types/goto-line-options'
import { Doc } from '../../../../../types/doc'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findDocEntityById } from '@/features/ide-react/util/find-doc-entity-by-id'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useTranslation } from 'react-i18next'
import customLocalStorage from '@/infrastructure/local-storage'
import useEventListener from '@/shared/hooks/use-event-listener'
import { EditorType } from '@/features/ide-react/editor/types/editor-type'
import { DocId } from '../../../../../types/project-settings'
import { Update } from '@/features/history/services/types/update'
import { useDebugDiffTracker } from '../hooks/use-debug-diff-tracker'
import { useEditorContext } from '@/shared/context/editor-context'

interface GotoOffsetOptions {
  gotoOffset: number
}

interface OpenDocOptions
  extends Partial<GotoLineOptions>,
    Partial<GotoOffsetOptions> {
  gotoOffset?: number
  forceReopen?: boolean
  keepCurrentView?: boolean
}

export type EditorManager = {
  getEditorType: () => EditorType | null
  showSymbolPalette: boolean
  currentDocument: DocumentContainer
  currentDocumentId: DocId | null
  getCurrentDocValue: () => string | null
  getCurrentDocId: () => DocId | null
  startIgnoringExternalUpdates: () => void
  stopIgnoringExternalUpdates: () => void
  openDocId: (docId: string, options?: OpenDocOptions) => void
  openDoc: (document: Doc, options?: OpenDocOptions) => void
  openDocs: OpenDocuments
  openInitialDoc: (docId: string) => void
  jumpToLine: (options: GotoLineOptions) => void
  wantTrackChanges: boolean
  setWantTrackChanges: React.Dispatch<
    React.SetStateAction<EditorManager['wantTrackChanges']>
  >
  debugTimers: React.MutableRefObject<Record<string, number>>
}

function hasGotoLine(options: OpenDocOptions): options is GotoLineOptions {
  return typeof options.gotoLine === 'number'
}

function hasGotoOffset(options: OpenDocOptions): options is GotoOffsetOptions {
  return typeof options.gotoOffset === 'number'
}

export type EditorScopeValue = {
  showSymbolPalette: false
  toggleSymbolPalette: () => void
  sharejs_doc: DocumentContainer | null
  open_doc_id: string | null
  open_doc_name: string | null
  opening: boolean
  trackChanges: boolean
  wantTrackChanges: boolean
  showVisual: boolean
  newSourceEditor: boolean
  error_state: boolean
}

export const EditorManagerContext = createContext<EditorManager | undefined>(
  undefined
)

export const EditorManagerProvider: FC = ({ children }) => {
  const { t } = useTranslation()
  const ide = useIdeContext()
  const { projectId } = useIdeReactContext()
  const { reportError, eventEmitter, eventLog } = useIdeReactContext()
  const { setOutOfSync } = useEditorContext()
  const { socket, disconnect, connectionState } = useConnectionContext()
  const { view, setView } = useLayoutContext()
  const { showGenericMessageModal, genericModalVisible, showOutOfSyncModal } =
    useModalsContext()

  const [showSymbolPalette, setShowSymbolPalette] = useScopeValue<boolean>(
    'editor.showSymbolPalette'
  )
  const [showVisual] = useScopeValue<boolean>('editor.showVisual')
  const [currentDocument, setCurrentDocument] =
    useScopeValue<DocumentContainer>('editor.sharejs_doc')
  const [openDocId, setOpenDocId] = useScopeValue<DocId | null>(
    'editor.open_doc_id'
  )
  const [, setOpenDocName] = useScopeValue<string | null>(
    'editor.open_doc_name'
  )
  const [, setOpening] = useScopeValue<boolean>('editor.opening')
  const [, setIsInErrorState] = useScopeValue<boolean>('editor.error_state')
  const [, setTrackChanges] = useScopeValue<boolean>('editor.trackChanges')
  const [wantTrackChanges, setWantTrackChanges] = useScopeValue<boolean>(
    'editor.wantTrackChanges'
  )

  const wantTrackChangesRef = useRef(wantTrackChanges)
  useEffect(() => {
    wantTrackChangesRef.current = wantTrackChanges
  }, [wantTrackChanges])

  const goToLineEmitter = useScopeEventEmitter('editor:gotoLine')

  const { fileTreeData } = useFileTreeData()

  const [ignoringExternalUpdates, setIgnoringExternalUpdates] = useState(false)

  const { createDebugDiff, debugTimers } = useDebugDiffTracker(
    projectId,
    currentDocument
  )

  const [globalEditorWatchdogManager] = useState(
    () =>
      new EditorWatchdogManager({
        onTimeoutHandler: (meta: Record<string, any>) => {
          let diffSize: number | null = null
          createDebugDiff()
            .then(calculatedDiffSize => {
              diffSize = calculatedDiffSize
            })
            .finally(() => {
              sendMB('losing-edits', {
                ...meta,
                diffSize,
                timers: debugTimers.current,
              })
              reportError('losing-edits', {
                ...meta,
                diffSize,
                timers: debugTimers.current,
              })
            })
        },
      })
  )

  // Store the most recent document error and consume it in an effect, which
  // prevents circular dependencies in useCallbacks
  const [docError, setDocError] = useState<{
    doc: Doc
    document: DocumentContainer
    error: Error | string
    meta?: Record<string, any>
    editorContent?: string
  } | null>(null)

  const [docTooLongErrorShown, setDocTooLongErrorShown] = useState(false)

  useEffect(() => {
    if (!genericModalVisible) {
      setDocTooLongErrorShown(false)
    }
  }, [genericModalVisible])

  const [openDocs] = useState(
    () =>
      new OpenDocuments(
        socket,
        globalEditorWatchdogManager,
        eventEmitter,
        eventLog
      )
  )

  const openDocIdStorageKey = `doc.open_id.${projectId}`

  // Persist the open document ID to local storage
  useEffect(() => {
    if (openDocId) {
      customLocalStorage.setItem(openDocIdStorageKey, openDocId)
    }
  }, [openDocId, openDocIdStorageKey])

  const editorOpenDocEpochRef = useRef(0)

  // TODO: This looks dodgy because it wraps a state setter and is itself
  // stored in React state in the scope store. The problem is that it needs to
  // be exposed via the scope store because some components access it that way;
  // it would be better to simply access it from a context, but the current
  // implementation in EditorManager interacts with Angular scope to update
  // the layout. Once Angular is gone, this can become a context method.
  useEffect(() => {
    ide.scopeStore.set('editor.toggleSymbolPalette', () => {
      setShowSymbolPalette(show => {
        const newValue = !show
        sendMB(newValue ? 'symbol-palette-show' : 'symbol-palette-hide')
        return newValue
      })
    })
  }, [ide.scopeStore, setShowSymbolPalette])

  const getEditorType = useCallback((): EditorType | null => {
    if (!currentDocument) {
      return null
    }

    return showVisual ? 'cm6-rich-text' : 'cm6'
  }, [currentDocument, showVisual])

  const getCurrentDocValue = useCallback(() => {
    return currentDocument?.getSnapshot() ?? null
  }, [currentDocument])

  const getCurrentDocId = useCallback(() => openDocId, [openDocId])

  const startIgnoringExternalUpdates = useCallback(
    () => setIgnoringExternalUpdates(true),
    []
  )
  const stopIgnoringExternalUpdates = useCallback(
    () => setIgnoringExternalUpdates(false),
    []
  )

  const jumpToLine = useCallback(
    (options: GotoLineOptions) => {
      goToLineEmitter(
        options.gotoLine,
        options.gotoColumn ?? 0,
        options.syncToPdf ?? false
      )
    },
    [goToLineEmitter]
  )

  const unbindFromDocumentEvents = (document: DocumentContainer) => {
    document.off()
  }

  const attachErrorHandlerToDocument = useCallback(
    (doc: Doc, document: DocumentContainer) => {
      document.on(
        'error',
        (
          error: Error | string,
          meta?: Record<string, any>,
          editorContent?: string
        ) => {
          setDocError({ doc, document, error, meta, editorContent })
        }
      )
    },
    []
  )

  const bindToDocumentEvents = useCallback(
    (doc: Doc, document: DocumentContainer) => {
      attachErrorHandlerToDocument(doc, document)

      document.on('externalUpdate', (update: Update) => {
        if (ignoringExternalUpdates) {
          return
        }
        if (
          update.meta.type === 'external' &&
          update.meta.source === 'git-bridge'
        ) {
          return
        }
        if (
          update.meta.origin?.kind === 'file-restore' ||
          update.meta.origin?.kind === 'project-restore'
        ) {
          return
        }
        showGenericMessageModal(
          t('document_updated_externally'),
          t('document_updated_externally_detail')
        )
      })
    },
    [
      attachErrorHandlerToDocument,
      ignoringExternalUpdates,
      showGenericMessageModal,
      t,
    ]
  )

  const syncTimeoutRef = useRef<number | null>(null)

  const syncTrackChangesState = useCallback(
    (doc: DocumentContainer) => {
      if (!doc) {
        return
      }

      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }

      const want = wantTrackChangesRef.current
      const have = doc.getTrackingChanges()
      if (want === have) {
        setTrackChanges(want)
        return
      }

      const tryToggle = () => {
        const saved = doc.getInflightOp() == null && doc.getPendingOp() == null
        if (saved) {
          doc.setTrackingChanges(want)
          setTrackChanges(want)
        } else {
          syncTimeoutRef.current = window.setTimeout(tryToggle, 100)
        }
      }

      tryToggle()
    },
    [setTrackChanges]
  )

  const doOpenNewDocument = useCallback(
    (doc: Doc) =>
      new Promise<DocumentContainer>((resolve, reject) => {
        debugConsole.log('[doOpenNewDocument] Opening...')
        const newDocument = openDocs.getDocument(doc._id)
        if (!newDocument) {
          debugConsole.error(`No open document with ID '${doc._id}' found`)
          reject(new Error('no open document found'))
          return
        }
        const preJoinEpoch = ++editorOpenDocEpochRef.current
        newDocument.join(error => {
          if (error) {
            debugConsole.log(
              `[doOpenNewDocument] error joining doc ${doc._id}`,
              error
            )
            reject(error)
            return
          }

          if (editorOpenDocEpochRef.current !== preJoinEpoch) {
            debugConsole.log(
              `[doOpenNewDocument] editorOpenDocEpoch mismatch ${editorOpenDocEpochRef.current} vs ${preJoinEpoch}`
            )
            newDocument.leaveAndCleanUp()
            reject(new Error('another document was loaded'))
          }
          bindToDocumentEvents(doc, newDocument)
          resolve(newDocument)
        })
      }),
    [bindToDocumentEvents, openDocs]
  )

  const openNewDocument = useCallback(
    async (doc: Doc): Promise<DocumentContainer> => {
      // Leave the current document
      //  - when we are opening a different new one, to avoid race conditions
      //     between leaving and joining the same document
      //  - when the current one has pending ops that need flushing, to avoid
      //     race conditions from cleanup
      const currentDocId = currentDocument?.doc_id
      const hasBufferedOps = currentDocument?.hasBufferedOps()
      const changingDoc = currentDocument && currentDocId !== doc._id
      if (changingDoc || hasBufferedOps) {
        debugConsole.log('[openNewDocument] Leaving existing open doc...')

        // Do not trigger any UI changes from remote operations
        unbindFromDocumentEvents(currentDocument)

        // Keep listening for out-of-sync and similar errors.
        attachErrorHandlerToDocument(doc, currentDocument)

        // Teardown the Document -> ShareJsDoc -> sharejs doc
        // By the time this completes, the Document instance is no longer
        //  registered in OpenDocuments and doOpenNewDocument can start
        //  from scratch -- read: no corrupted internal state.
        const preLeaveEpoch = ++editorOpenDocEpochRef.current

        try {
          await currentDocument.leaveAndCleanUpPromise()
        } catch (error) {
          debugConsole.log(
            `[openNewDocument] error leaving doc ${currentDocId}`,
            error
          )
          throw error
        }

        if (editorOpenDocEpochRef.current !== preLeaveEpoch) {
          debugConsole.log(
            `[openNewDocument] editorOpenDocEpoch mismatch ${editorOpenDocEpochRef.current} vs ${preLeaveEpoch}`
          )
          throw new Error('another document was loaded')
        }
      }
      return doOpenNewDocument(doc)
    },
    [attachErrorHandlerToDocument, doOpenNewDocument, currentDocument]
  )

  const openDocIdRef = useRef(openDocId)
  useEffect(() => {
    openDocIdRef.current = openDocId
  }, [openDocId])

  const openDoc = useCallback(
    async (doc: Doc, options: OpenDocOptions = {}) => {
      debugConsole.log(`[openDoc] Opening ${doc._id}`)
      if (view === 'editor') {
        // store position of previous doc before switching docs
        eventEmitter.emit('store-doc-position')
      }

      if (!options.keepCurrentView) {
        setView('editor')
      }

      const done = (isNewDoc: boolean) => {
        window.dispatchEvent(
          new CustomEvent('doc:after-opened', {
            detail: { isNewDoc, docId: doc._id },
          })
        )
        if (hasGotoLine(options)) {
          window.setTimeout(() => jumpToLine(options))

          // Jump to the line again after a stored scroll position has been restored
          if (isNewDoc) {
            window.addEventListener(
              'editor:scroll-position-restored',
              () => jumpToLine(options),
              { once: true }
            )
          }
        } else if (hasGotoOffset(options)) {
          window.setTimeout(() => {
            eventEmitter.emit('editor:gotoOffset', options.gotoOffset)
          })
        }
      }

      // If we already have the document open, or are opening the document, we can return at this point.
      // Note: only use forceReopen:true to override this when the document is
      // out of sync and needs to be reloaded from the server.
      if (doc._id === openDocIdRef.current && !options.forceReopen) {
        done(false)
        return
      }

      // We're now either opening a new document or reloading a broken one.
      openDocIdRef.current = doc._id as DocId
      setOpenDocId(doc._id as DocId)
      setOpenDocName(doc.name)
      setOpening(true)

      try {
        const document = await openNewDocument(doc)
        syncTrackChangesState(document)
        eventEmitter.emit('doc:opened')
        setOpening(false)
        setCurrentDocument(document)
        done(true)
      } catch (error: any) {
        if (error?.message === 'another document was loaded') {
          debugConsole.log(
            `[openDoc] another document was loaded while ${doc._id} was loading`
          )
          return
        }
        debugConsole.error('Error opening document', error)
        showGenericMessageModal(
          t('error_opening_document'),
          t('error_opening_document_detail')
        )
      }
    },
    [
      eventEmitter,
      jumpToLine,
      openNewDocument,
      setCurrentDocument,
      setOpenDocId,
      setOpenDocName,
      setOpening,
      setView,
      showGenericMessageModal,
      syncTrackChangesState,
      t,
      view,
    ]
  )

  const openDocWithId = useCallback(
    (docId: string, options: OpenDocOptions = {}) => {
      const doc = findDocEntityById(fileTreeData, docId)
      if (!doc) {
        return
      }
      openDoc(doc, options)
    },
    [fileTreeData, openDoc]
  )

  const openInitialDoc = useCallback(
    (fallbackDocId: string) => {
      const docId =
        customLocalStorage.getItem(openDocIdStorageKey) || fallbackDocId
      if (docId) {
        openDocWithId(docId)
      }
    },
    [openDocIdStorageKey, openDocWithId]
  )

  useEffect(() => {
    if (docError) {
      const { doc, document, error, meta } = docError
      let { editorContent } = docError
      const message = typeof error === 'string' ? error : (error?.message ?? '')

      // Clear document error so that it's only handled once
      setDocError(null)

      if (message.includes('maxDocLength')) {
        openDoc(doc, { forceReopen: true })
        const hasTrackedDeletes =
          document.ranges != null &&
          document.ranges.changes.some(change => 'd' in change.op)
        const explanation = hasTrackedDeletes
          ? `${t('document_too_long_detail')} ${t('document_too_long_tracked_deletes')}`
          : t('document_too_long_detail')

        showGenericMessageModal(t('document_too_long'), explanation)
        setDocTooLongErrorShown(true)
      } else if (/too many comments or tracked changes/.test(message)) {
        showGenericMessageModal(
          t('too_many_comments_or_tracked_changes'),
          t('too_many_comments_or_tracked_changes_detail')
        )
      } else if (!docTooLongErrorShown) {
        // Do not allow this doc to open another error modal.
        document.off('error')

        // Preserve the sharejs contents before the teardown.
        // eslint-disable-next-line no-unused-vars
        editorContent =
          typeof editorContent === 'string'
            ? editorContent
            : document.doc?._doc.snapshot

        // Tear down the ShareJsDoc.
        if (document.doc) document.doc.clearInflightAndPendingOps()

        // Do not re-join after re-connecting.
        document.leaveAndCleanUp()

        disconnect()
        reportError(error, meta)

        // Tell the user about the error state.
        setIsInErrorState(true)
        // Ensure that the editor is locked
        setOutOfSync(true)
        // Display the "out of sync" modal
        showOutOfSyncModal(editorContent || '')

        // Do not forceReopen the document.
        return
      }

      const handleProjectJoined = () => {
        openDoc(doc, { forceReopen: true })
      }

      eventEmitter.once('project:joined', handleProjectJoined)

      return () => {
        eventEmitter.off('project:joined', handleProjectJoined)
      }
    }
  }, [
    disconnect,
    docError,
    docTooLongErrorShown,
    eventEmitter,
    openDoc,
    reportError,
    setIsInErrorState,
    showGenericMessageModal,
    showOutOfSyncModal,
    setOutOfSync,
    t,
  ])

  useEventListener('editor:insert-symbol', () => {
    sendMB('symbol-palette-insert')
  })

  useEventListener('flush-changes', () => {
    openDocs.flushAll()
  })

  useEventListener('blur', () => {
    openDocs.flushAll()
  })

  // Flush changes before disconnecting
  useEffect(() => {
    if (connectionState.forceDisconnected) {
      openDocs.flushAll()
    }
  }, [connectionState.forceDisconnected, openDocs])

  // Watch for changes in wantTrackChanges
  const previousWantTrackChangesRef = useRef(wantTrackChanges)
  useEffect(() => {
    if (wantTrackChanges !== previousWantTrackChangesRef.current) {
      previousWantTrackChangesRef.current = wantTrackChanges
      syncTrackChangesState(currentDocument)
    }
  }, [currentDocument, syncTrackChangesState, wantTrackChanges])

  const editorManager = useMemo(
    () => ({
      getEditorType,
      showSymbolPalette,
      currentDocument,
      currentDocumentId: openDocId,
      getCurrentDocValue,
      getCurrentDocId,
      startIgnoringExternalUpdates,
      stopIgnoringExternalUpdates,
      openDocId: openDocWithId,
      openDoc,
      openDocs,
      openInitialDoc,
      jumpToLine,
      wantTrackChanges,
      setWantTrackChanges,
      debugTimers,
    }),
    [
      getEditorType,
      showSymbolPalette,
      currentDocument,
      openDocId,
      getCurrentDocValue,
      getCurrentDocId,
      startIgnoringExternalUpdates,
      stopIgnoringExternalUpdates,
      openDocWithId,
      openDoc,
      openDocs,
      openInitialDoc,
      jumpToLine,
      wantTrackChanges,
      setWantTrackChanges,
      debugTimers,
    ]
  )

  // Expose editorManager via ide object because some React code relies on it,
  // for now
  ide.editorManager = editorManager

  return (
    <EditorManagerContext.Provider value={editorManager}>
      {children}
    </EditorManagerContext.Provider>
  )
}

export function useEditorManagerContext(): EditorManager {
  const context = useContext(EditorManagerContext)

  if (!context) {
    throw new Error(
      'useEditorManagerContext is only available inside EditorManagerProvider'
    )
  }

  return context
}
