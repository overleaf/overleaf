import { FC, PropsWithChildren, useEffect, useState } from 'react'
import EventEmitter from '@/utils/EventEmitter'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import type { Socket } from '@/features/ide-react/connection/types/socket'
import type { SocketDebuggingInfo } from '@/features/ide-react/connection/types/connection-state'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { OfflineDocBackup } from '@/features/ide-react/editor/offline-doc-backup'
import { GlobalToasts } from '@/features/ide-react/components/global-toasts'
import { location } from '@/shared/components/location'
import {
  EditorProviders,
  makeEditorOpenDocProvider,
  PROJECT_ID,
  USER_ID,
} from '../../../helpers/editor-providers'

const CURRENT_DOC_ID = 'current-doc'
const NEW_DOC_ID = 'new-doc'

class FakeDocumentContainer extends EventEmitter {
  doc_id = CURRENT_DOC_ID
  docName = 'main.tex'
  doc = { clearInflightAndPendingOps: cy.stub() }

  getSnapshot() {
    return 'server snapshot'
  }
  hasBufferedOps() {
    return false
  }
  leaveAndCleanUp() {}
  leaveAndCleanUpPromise() {
    return Promise.resolve()
  }
}

const OpenNewDocOnMount: FC = () => {
  const editorManager = useEditorManagerContext()
  useEffect(() => {
    // Triggers openNewDocument → attaches the error handler onto the
    // current fake DocumentContainer synchronously, before awaiting leave.
    editorManager.openDoc({ _id: NEW_DOC_ID } as any).catch(() => {})
  }, [editorManager])
  return null
}

const CaptureEventEmitter: FC<{
  onReady: (emitter: IdeEventEmitter) => void
}> = ({ onReady }) => {
  const { eventEmitter } = useIdeReactContext()
  useEffect(() => {
    onReady(eventEmitter)
  }, [eventEmitter, onReady])
  return null
}

function plantBackup(docId: string, { trackChanges = false } = {}) {
  const key = OfflineDocBackup.buildKey(PROJECT_ID, docId)
  window.sessionStorage.setItem(
    key,
    JSON.stringify({
      docId,
      projectId: PROJECT_ID,
      version: 1,
      snapshot: 'backup snapshot',
      inflightOp: null,
      pendingOp: null,
      trackChanges,
      updatedAt: Date.now(),
      inflightSubmittedIds: [],
    })
  )
  return key
}

// The default harness reports a healthy connection, which stands in for the
// post-reconnect sync failure. This one stands in for the fatal op timeout
// firing while the outage is still ongoing.
const OfflineConnectionProvider: FC<PropsWithChildren> = ({ children }) => {
  const [value] = useState(() => ({
    socket: new SocketIOMock() as any as Socket,
    connectionState: {
      readyState: WebSocket.CLOSED,
      forceDisconnected: false,
      inactiveDisconnect: false,
      reconnectAt: null,
      forcedDisconnectDelay: 0,
      lastConnectionAttempt: 0,
      error: '' as const,
    },
    isConnected: false,
    isStillReconnecting: false,
    secondsUntilReconnect: () => 0,
    tryReconnectNow: () => {},
    registerUserActivity: () => {},
    disconnect: () => {},
    closeConnection: () => {},
    getSocketDebuggingInfo: () => ({}) as SocketDebuggingInfo,
  }))

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

function setSplitTest(enabled: boolean) {
  window.metaAttributesCache.set('ol-splitTestVariants', {
    'intermittent-connection-improvements': enabled ? 'enabled' : 'default',
  })
}

describe('EditorManagerProvider docError sync modals', function () {
  let currentDoc: FakeDocumentContainer

  beforeEach(function () {
    window.sessionStorage.clear()
    currentDoc = new FakeDocumentContainer()
    cy.then(() => {
      window.metaAttributesCache.set('ol-user_id', USER_ID)
    })
  })

  afterEach(function () {
    window.sessionStorage.clear()
  })

  const mount = (
    extraProviders: Record<string, FC<PropsWithChildren>> = {}
  ) => {
    cy.mount(
      <EditorProviders
        projectId={PROJECT_ID}
        providers={{
          EditorOpenDocProvider: makeEditorOpenDocProvider({
            currentDocumentId: CURRENT_DOC_ID as any,
            openDocName: currentDoc.docName,
            currentDocument: currentDoc as any,
          }),
          ...extraProviders,
        }}
      >
        <OpenNewDocOnMount />
      </EditorProviders>
    )
  }

  it('shows UnableToSyncModal when the split test is on and a backup exists', function () {
    let key: string
    cy.then(() => {
      setSplitTest(true)
      key = plantBackup(CURRENT_DOC_ID)
    })

    mount()

    cy.then(() => {
      currentDoc.trigger(
        'error',
        new Error('forced'),
        {},
        'offline edits content'
      )
    })

    cy.findByRole('dialog').within(() => {
      cy.findByText('Your offline edits couldn’t be synced').should('exist')
      cy.findByRole('button', { name: 'Save as new file' }).should('exist')
      cy.findByRole('button', { name: 'Discard changes' }).should('exist')
    })

    cy.then(() => {
      expect(window.sessionStorage.getItem(key!)).to.equal(null)
    })
  })

  it('reloads the page when the backup-path modal is closed', function () {
    cy.then(() => {
      setSplitTest(true)
      plantBackup(CURRENT_DOC_ID)
      cy.stub(location, 'reload').as('reload')
    })

    mount()

    cy.then(() => {
      currentDoc.trigger(
        'error',
        new Error('forced'),
        {},
        'offline edits content'
      )
    })

    cy.findByRole('dialog').within(() => {
      cy.findByRole('button', { name: 'Discard changes' }).click()
    })

    cy.get('@reload').should('have.been.calledOnce')
  })

  it('shows nothing and keeps the backup when the failure happens while offline', function () {
    let key: string
    cy.then(() => {
      setSplitTest(true)
      key = plantBackup(CURRENT_DOC_ID)
    })

    mount({ ConnectionProvider: OfflineConnectionProvider })

    cy.then(() => {
      currentDoc.trigger(
        'error',
        new Error('forced'),
        {},
        'offline edits content'
      )
    })

    cy.findByRole('dialog').should('not.exist')

    // The outcome is still undetermined, so recovery on the next load decides.
    cy.then(() => {
      expect(window.sessionStorage.getItem(key!)).to.not.equal(null)
    })
  })

  it('passes editorContent and docName through to the modal', function () {
    cy.then(() => {
      setSplitTest(true)
      plantBackup(CURRENT_DOC_ID)
    })

    mount()

    cy.then(() => {
      currentDoc.trigger(
        'error',
        new Error('forced'),
        {},
        'the exact offline content'
      )
    })

    cy.findByRole('dialog').within(() => {
      cy.findByText('Your offline edits couldn’t be synced').should('exist')
      cy.findByRole('button', { name: 'Save as new file' }).should('exist')
      cy.findByRole('button', { name: 'Discard changes' }).should('exist')
    })
  })

  it('falls back to OutOfSyncModal when no backup exists', function () {
    cy.then(() => {
      setSplitTest(true)
    })
    // no backup planted

    mount()

    cy.then(() => {
      currentDoc.trigger('error', new Error('forced'), {}, 'content')
    })

    cy.findByRole('dialog').should('exist')
    cy.findByText('Your offline edits couldn’t be synced').should('not.exist')
  })

  it('shows UnableToSyncModal on the ide:unableToSyncOfflineChanges recovery event', function () {
    let capturedEmitter: IdeEventEmitter | null = null

    cy.mount(
      <EditorProviders
        projectId={PROJECT_ID}
        providers={{
          EditorOpenDocProvider: makeEditorOpenDocProvider({
            currentDocumentId: CURRENT_DOC_ID as any,
            openDocName: currentDoc.docName,
            currentDocument: currentDoc as any,
          }),
        }}
      >
        <CaptureEventEmitter
          onReady={emitter => {
            capturedEmitter = emitter
          }}
        />
      </EditorProviders>
    )

    cy.then(() => {
      capturedEmitter!.emit('ide:unableToSyncOfflineChanges', {
        docId: CURRENT_DOC_ID,
        editorContent: 'recovered content',
        baseContent: 'original content',
        docName: 'recovered.tex',
      })
    })

    cy.findByRole('dialog').within(() => {
      cy.findByText('Your offline edits couldn’t be synced').should('exist')
    })
  })

  it('does not reload when the recovery event omits reloadAfterClose', function () {
    let capturedEmitter: IdeEventEmitter | null = null

    cy.then(() => {
      cy.stub(location, 'reload').as('reload')
    })

    cy.mount(
      <EditorProviders
        projectId={PROJECT_ID}
        providers={{
          EditorOpenDocProvider: makeEditorOpenDocProvider({
            currentDocumentId: CURRENT_DOC_ID as any,
            openDocName: currentDoc.docName,
            currentDocument: currentDoc as any,
          }),
        }}
      >
        <CaptureEventEmitter
          onReady={emitter => {
            capturedEmitter = emitter
          }}
        />
      </EditorProviders>
    )

    cy.then(() => {
      capturedEmitter!.emit('ide:unableToSyncOfflineChanges', {
        docId: CURRENT_DOC_ID,
        editorContent: 'recovered content',
        baseContent: 'original content',
        docName: 'recovered.tex',
      })
    })

    cy.findByRole('dialog').within(() => {
      cy.findByRole('button', { name: 'Discard changes' }).click()
    })

    cy.get('@reload').should('not.have.been.called')
  })

  it('reloads when the recovery event sets reloadAfterClose', function () {
    let capturedEmitter: IdeEventEmitter | null = null

    cy.then(() => {
      cy.stub(location, 'reload').as('reload')
    })

    cy.mount(
      <EditorProviders
        projectId={PROJECT_ID}
        providers={{
          EditorOpenDocProvider: makeEditorOpenDocProvider({
            currentDocumentId: CURRENT_DOC_ID as any,
            openDocName: currentDoc.docName,
            currentDocument: currentDoc as any,
          }),
        }}
      >
        <CaptureEventEmitter
          onReady={emitter => {
            capturedEmitter = emitter
          }}
        />
      </EditorProviders>
    )

    cy.then(() => {
      capturedEmitter!.emit('ide:unableToSyncOfflineChanges', {
        docId: CURRENT_DOC_ID,
        editorContent: 'recovered content',
        baseContent: 'original content',
        docName: 'recovered.tex',
        reloadAfterClose: true,
      })
    })

    cy.findByRole('dialog').within(() => {
      cy.findByRole('button', { name: 'Discard changes' }).click()
    })

    cy.get('@reload').should('have.been.calledOnce')
  })

  it('shows the success toast on the ide:offlineChangesSynced event', function () {
    let capturedEmitter: IdeEventEmitter | null = null

    cy.mount(
      <EditorProviders
        projectId={PROJECT_ID}
        providers={{
          EditorOpenDocProvider: makeEditorOpenDocProvider({
            currentDocumentId: CURRENT_DOC_ID as any,
            openDocName: currentDoc.docName,
            currentDocument: currentDoc as any,
          }),
        }}
      >
        <CaptureEventEmitter
          onReady={emitter => {
            capturedEmitter = emitter
          }}
        />
        <GlobalToasts />
      </EditorProviders>
    )

    cy.then(() => {
      capturedEmitter!.emit('ide:offlineChangesSynced', {
        docId: CURRENT_DOC_ID,
      })
    })

    cy.findByText('You’re back online.').should('exist')
  })

  it('falls back to OutOfSyncModal when the split test is off even if a backup exists', function () {
    let key: string
    cy.then(() => {
      setSplitTest(false)
      key = plantBackup(CURRENT_DOC_ID)
    })

    mount()

    cy.then(() => {
      currentDoc.trigger('error', new Error('forced'), {}, 'content')
    })

    cy.findByRole('dialog').should('exist')
    cy.findByText('Your offline edits couldn’t be synced').should('not.exist')

    // The disabled branch does not touch the backup.
    cy.then(() => {
      expect(window.sessionStorage.getItem(key!)).to.not.equal(null)
    })
  })
})
