/* eslint-disable no-use-before-define */
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
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
import customLocalStorage from '@/infrastructure/local-storage'
import { sendMB } from '@/infrastructure/event-tracking'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { useIdeContext } from '@/shared/context/ide-context'
import { OpenDocuments } from '@/features/ide-react/editor/open-documents'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugConsole } from '@/utils/debugging'
import { Document } from '@/features/ide-react/editor/document'
import { useLayoutContext } from '@/shared/context/layout-context'
import { GotoLineOptions } from '@/features/ide-react/types/goto-line-options'
import _ from 'lodash'
import { Doc } from '../../../../../types/doc'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findDocEntityById } from '@/features/ide-react/util/find-doc-entity-by-id'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'

interface GotoOffsetOptions {
  gotoOffset: number
}

interface OpenDocOptions
  extends Partial<GotoLineOptions>,
    Partial<GotoOffsetOptions> {
  gotoOffset?: number
  forceReopen?: boolean
}

type EditorManager = {
  getEditorType: () => 'cm6' | 'cm6-rich-text' | null
  showSymbolPalette: boolean
  currentDocument: Document
  getCurrentDocValue: () => string | null
  getCurrentDocId: () => string | null
  startIgnoringExternalUpdates: () => void
  stopIgnoringExternalUpdates: () => void
  openDocId: (docId: string, options?: OpenDocOptions) => void
  openDoc: (document: Document, options?: OpenDocOptions) => void
  jumpToLine: (options: GotoLineOptions) => void
}

type DocumentOpenCallback = (error: Error | null, document?: Document) => void

function hasGotoLine(options: OpenDocOptions): options is GotoLineOptions {
  return typeof options.gotoLine === 'number'
}

function hasGotoOffset(options: OpenDocOptions): options is GotoOffsetOptions {
  return typeof options.gotoOffset === 'number'
}

export type EditorScopeValue = {
  showSymbolPalette: false
  toggleSymbolPalette: () => void
  sharejs_doc: Document | null
  open_doc_id: string | null
  open_doc_name: string | null
  opening: boolean
  trackChanges: boolean
  wantTrackChanges: boolean
  showVisual: boolean
  newSourceEditor: boolean
  multiSelectedCount: number
  error_state: boolean
}

export function populateEditorScope(store: ReactScopeValueStore) {
  const projectId = window.project_id

  // This value is not used in the React code. It's just here to prevent errors
  // from EditorProvider
  store.set('state.loading', false)

  store.set('project.name', null)

  store.set('editor', {
    showSymbolPalette: false,
    toggleSymbolPalette: () => {},
    sharejs_doc: null,
    open_doc_id: null,
    open_doc_name: null,
    opening: true,
    trackChanges: false,
    wantTrackChanges: false,
    // No Ace here
    newSourceEditor: true,
    // TODO: Ignore multiSelectedCount and just default it to zero for now until
    // we get to the file tree. It seems to be stored in two places in the
    // Angular scope and needs further investigation.
    multiSelectedCount: 0,
    error_state: false,
  })
  store.persisted('editor.showVisual', false, `editor.mode.${projectId}`, {
    toPersisted: showVisual => (showVisual ? 'rich-text' : 'source'),
    fromPersisted: mode => mode === 'rich-text',
  })
}

const EditorManagerContext = createContext<EditorManager | undefined>(undefined)

export const EditorManagerProvider: FC = ({ children }) => {
  const ide = useIdeContext()
  const { reportError, eventEmitter, eventLog, projectId } =
    useIdeReactContext()
  const { socket, disconnect } = useConnectionContext()
  const { view, setView } = useLayoutContext()

  const [showSymbolPalette, setShowSymbolPalette] = useScopeValue<boolean>(
    'editor.showSymbolPalette'
  )
  const [showVisual] = useScopeValue<boolean>('editor.showVisual')
  // eslint-disable-next-line no-unused-vars
  const [currentDocument, setCurrentDocument] =
    useScopeValue<Document>('editor.sharejs_doc')
  const [openDocId, setOpenDocId] = useScopeValue<string | null>(
    'editor.open_doc_id'
  )
  const [, setOpenDocName] = useScopeValue<string | null>(
    'editor.open_doc_name'
  )
  const [, setOpening] = useScopeValue<boolean>('editor.opening')
  const [, setIsInErrorState] = useScopeValue<boolean>('editor.error_state')
  const [, setTrackChanges] = useScopeValue<boolean>('editor.trackChanges')
  const [wantTrackChanges] = useScopeValue<boolean>('editor.wantTrackChanges')

  const goToLineEmitter = useScopeEventEmitter('editor:gotoLine')

  const { fileTreeData } = useFileTreeData()

  // eslint-disable-next-line no-unused-vars
  const [ignoringExternalUpdates, setIgnoringExternalUpdates] = useState(false)

  const [globalEditorWatchdogManager] = useState(
    () =>
      new EditorWatchdogManager({
        onTimeoutHandler: (meta: Record<string, any>) => {
          sendMB('losing-edits', meta)
          reportError('losing-edits', meta)
        },
      })
  )

  const [docTooLongErrorShown, setDocTooLongErrorShown] = useState(false)

  const [openDocs] = useState(
    () =>
      new OpenDocuments(
        socket,
        globalEditorWatchdogManager,
        eventEmitter,
        eventLog
      )
  )

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

  const getEditorType = useCallback(() => {
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

  // Ignore insertSymbol from Angular EditorManager because it's only required
  // for Ace.

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

  const unbindFromDocumentEvents = (document: Document) => {
    document.off()
  }

  const openDocWithId = useCallback(
    (docId: string, options: OpenDocOptions = {}) => {
      const doc = findDocEntityById(fileTreeData, docId)
      if (!doc) {
        return
      }
      openDoc(doc, options)
    },
    // @ts-ignore
    [fileTreeData, openDoc]
  )

  // @ts-ignore
  const attachErrorHandlerToDocument = useCallback(
    (doc: Doc, document: Document) => {
      document.on(
        'error',
        (
          error: Error | string,
          meta?: Record<string, any>,
          editorContent?: string
        ) => {
          const message =
            typeof error === 'string' ? error : error?.message ?? ''
          if (/maxDocLength/.test(message)) {
            setDocTooLongErrorShown(true)
            openDoc(doc, { forceReopen: true })

            // TODO: MIGRATION: Show generic modal here
            // const genericMessageModal = this.ide.showGenericMessageModal(
            //   'Document Too Long',
            //   'Sorry, this file is too long to be edited manually. Please upload it directly.'
            // )
            // genericMessageModal.result.finally(() => {
            //   this.$scope.docTooLongErrorShown = false
            // })
          } else if (/too many comments or tracked changes/.test(message)) {
            // TODO: MIGRATION: Show generic modal here
            // this.ide.showGenericMessageModal(
            //   'Too many comments or tracked changes',
            //   'Sorry, this file has too many comments or tracked changes. Please try accepting or rejecting some existing changes, or resolving and deleting some comments.'
            // )
          } else if (!docTooLongErrorShown) {
            // Do not allow this doc to open another error modal.
            document.off('error')

            // Preserve the sharejs contents before the teardown.
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

            // TODO: MIGRATION: Show out-of-sync modal
            // this.ide.showOutOfSyncModal(
            //   'Out of sync',
            //   "Sorry, this file has gone out of sync and we need to do a full refresh. <br> <a target='_blank' rel='noopener noreferrer' href='/learn/Kb/Editor_out_of_sync_problems'>Please see this help guide for more information</a>",
            //   editorContent
            // )

            // Do not forceReopen the document.
            return
          }

          eventEmitter.once('project:joined', () => {
            openDoc(doc, { forceReopen: true })
          })
        }
      )
    },
    [
      disconnect,
      docTooLongErrorShown,
      eventEmitter,
      // @ts-ignore
      openDoc,
      reportError,
      setIsInErrorState,
    ]
  )

  const bindToDocumentEvents = useCallback(
    (doc: Doc, document: Document) => {
      attachErrorHandlerToDocument(doc, document)

      // TODO: MIGRATION: Add a type for `update`
      document.on('externalUpdate', (update: any) => {
        if (ignoringExternalUpdates) {
          return
        }
        if (
          _.property(['meta', 'type'])(update) === 'external' &&
          _.property(['meta', 'source'])(update) === 'git-bridge'
        ) {
          // eslint-disable-next-line no-useless-return
          return
        }
        // TODO: MIGRATION: Show generic modal here
        // this.ide.showGenericMessageModal(
        //   'Document Updated Externally',
        //   'This document was just updated externally. Any recent changes you have made may have been overwritten. To see previous versions please look in the history.'
        // )
      })
    },
    [attachErrorHandlerToDocument, ignoringExternalUpdates]
  )

  const syncTimeoutRef = useRef<number | null>(null)

  const syncTrackChangesState = useCallback(
    (doc: Document) => {
      if (!doc) {
        return
      }

      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }

      const want = wantTrackChanges
      const have = doc.getTrackingChanges()
      if (wantTrackChanges === have) {
        setTrackChanges(want)
        return
      }

      const tryToggle = () => {
        const saved = doc.getInflightOp() == null && doc.getPendingOp() == null
        if (saved) {
          doc.setTrackingChanges(wantTrackChanges)
          setTrackChanges(want)
        } else {
          syncTimeoutRef.current = window.setTimeout(tryToggle, 100)
        }
      }

      tryToggle()
    },
    [setTrackChanges, wantTrackChanges]
  )

  const doOpenNewDocument = useCallback(
    (doc: Doc, callback: DocumentOpenCallback) => {
      debugConsole.log('[doOpenNewDocument] Opening...')
      const newDocument = openDocs.getDocument(doc._id)
      if (!newDocument) {
        debugConsole.error(`No open document with ID '${doc._id}' found`)
        return
      }
      const preJoinEpoch = ++editorOpenDocEpochRef.current
      newDocument.join(error => {
        if (error) {
          debugConsole.log(
            `[doOpenNewDocument] error joining doc ${doc._id}`,
            error
          )
          callback(error)
        }
        if (editorOpenDocEpochRef.current !== preJoinEpoch) {
          debugConsole.log(
            `[openNewDocument] editorOpenDocEpoch mismatch ${editorOpenDocEpochRef.current} vs ${preJoinEpoch}`
          )
          newDocument.leaveAndCleanUp()
          return callback(new Error('another document was loaded'))
        }
        bindToDocumentEvents(doc, newDocument)
        return callback(null, newDocument)
      })
    },
    [bindToDocumentEvents, openDocs]
  )

  // @ts-ignore
  const openNewDocument = useCallback(
    (doc: Doc, callback: DocumentOpenCallback) => {
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

        currentDocument.leaveAndCleanUp(error => {
          if (error) {
            debugConsole.log(
              `[_openNewDocument] error leaving doc ${currentDocId}`,
              error
            )
            return callback(error)
          }
          if (editorOpenDocEpochRef.current !== preLeaveEpoch) {
            debugConsole.log(
              `[openNewDocument] editorOpenDocEpoch mismatch ${editorOpenDocEpochRef.current} vs ${preLeaveEpoch}`
            )
            callback(new Error('another document was loaded'))
          }
          doOpenNewDocument(doc, callback)
        })
      } else {
        doOpenNewDocument(doc, callback)
      }
    },
    [attachErrorHandlerToDocument, doOpenNewDocument, currentDocument]
  )

  // @ts-ignore
  const openDoc = useCallback(
    (doc: Doc, options: OpenDocOptions = {}) => {
      debugConsole.log(`[openDoc] Opening ${doc._id}`)
      if (view === 'editor') {
        // store position of previous doc before switching docs
        eventEmitter.emit('store-doc-position')
      }
      setView('editor')

      const done = (isNewDoc: boolean) => {
        window.dispatchEvent(
          new CustomEvent('doc:after-opened', { detail: isNewDoc })
        )
        if (hasGotoLine(options)) {
          // In CM6, jump to the line again after a stored scroll position has been restored
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

      // If we already have the document open we can return at this point.
      // Note: only use forceReopen:true to override this when the document is
      // out of sync and needs to be reloaded from the server.
      if (doc._id === openDocId && !options.forceReopen) {
        window.dispatchEvent(
          new CustomEvent('editor.openDoc', { detail: doc._id })
        )
        done(false)
        return
      }

      // We're now either opening a new document or reloading a broken one.
      setOpenDocId(doc._id)
      setOpenDocName(doc.name)
      customLocalStorage.setItem(`doc.open_id.${projectId}`, doc._id)

      setOpening(true)

      openNewDocument(doc, (error: Error | null, document: Document) => {
        if (error?.message === 'another document was loaded') {
          debugConsole.log(
            `[openDoc] another document was loaded while ${doc._id} was loading`
          )
          return
        }
        if (error != null) {
          // TODO: MIGRATION: Show generic modal here
          // this.ide.showGenericMessageModal(
          //   'Error opening document',
          //   'Sorry, something went wrong opening this document. Please try again.'
          // )
          return
        }

        syncTrackChangesState(document)

        eventEmitter.emit('doc:opened')

        setOpening(false)
        setCurrentDocument(document)
        done(true)
      })
    },
    [
      eventEmitter,
      jumpToLine,
      openDocId,
      openNewDocument,
      projectId,
      setCurrentDocument,
      setOpenDocId,
      setOpenDocName,
      setOpening,
      setView,
      syncTrackChangesState,
      view,
    ]
  )

  const editorManager = useMemo(
    () => ({
      getEditorType,
      showSymbolPalette,
      currentDocument,
      getCurrentDocValue,
      getCurrentDocId,
      startIgnoringExternalUpdates,
      stopIgnoringExternalUpdates,
      openDocId: openDocWithId,
      openDoc,
      jumpToLine,
    }),
    [
      getEditorType,
      showSymbolPalette,
      currentDocument,
      getCurrentDocValue,
      getCurrentDocId,
      startIgnoringExternalUpdates,
      stopIgnoringExternalUpdates,
      openDocWithId,
      openDoc,
      jumpToLine,
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
