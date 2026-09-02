import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import { UnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { GlobalAlertsProvider } from '@/features/ide-react/context/global-alerts-context'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { EditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'

const defaultUnsavedDocsContextValue = {
  unsavedDocs: new Map<string, number>([['doc1', 16]]),
  isLocked: false,
  isSavingStalled: false,
}

const mockSocket = {
  socket: { transport: { name: 'websocket' } },
} as any

const mockConnectionContextValue = {
  socket: mockSocket,
  connectionState: { readyState: WebSocket.OPEN },
  isConnected: true,
  isStillReconnecting: false,
  secondsUntilReconnect: () => 0,
  tryReconnectNow: () => {},
  registerUserActivity: () => {},
  closeConnection: () => {},
  getSocketDebuggingInfo: () => ({ id: '' }),
} as any

const mockFileTreePathContextValue = {
  dirname: () => '',
  pathInFolder: (docId: string) => (docId === 'doc1' ? 'main.tex' : null),
  findEntityByPath: (path: string) =>
    path === 'main.tex'
      ? { entity: { _id: 'doc1', name: 'main.tex' }, type: 'doc' as const }
      : null,
  previewByPath: () => null,
}

const mockEditorManagerContextValue = {
  openDocs: {
    getUnsavedOpsSize: () => ({ pendingOpsLength: 2, inflightOpsLength: 1 }),
  },
} as any

const mount = ({
  unsavedDocsContextValue = defaultUnsavedDocsContextValue,
  reportError = cy.stub(),
}: {
  unsavedDocsContextValue?: typeof defaultUnsavedDocsContextValue
  reportError?: any
} = {}) => {
  const ideReactContextValue = { reportError } as any
  cy.mount(
    <SplitTestProvider>
      <GlobalAlertsProvider>
        <ConnectionContext.Provider value={mockConnectionContextValue}>
          <IdeReactContext.Provider value={ideReactContextValue}>
            <EditorManagerContext.Provider
              value={mockEditorManagerContextValue}
            >
              <FileTreePathContext.Provider
                value={mockFileTreePathContextValue}
              >
                <UnsavedDocsContext.Provider value={unsavedDocsContextValue}>
                  <UnsavedDocs />
                </UnsavedDocsContext.Provider>
              </FileTreePathContext.Provider>
            </EditorManagerContext.Provider>
          </IdeReactContext.Provider>
        </ConnectionContext.Provider>
      </GlobalAlertsProvider>
    </SplitTestProvider>
  )
}

const enableFlag = () => {
  cy.window().then(win => {
    win.metaAttributesCache.set('ol-splitTestVariants', {
      'intermittent-connection-improvements': 'enabled',
    })
  })
}

describe('<UnsavedDocs />', function () {
  it('shows UnsavedDocsAlert when flag is disabled', function () {
    mount()
    cy.findByRole('alert').should('exist')
  })

  it('suppresses UnsavedDocsAlert when flag is enabled', function () {
    enableFlag()
    mount()
    cy.findByRole('alert').should('not.exist')
  })

  describe('when locked', function () {
    const lockedContextValue = {
      unsavedDocs: new Map<string, number>(),
      isLocked: true,
      isSavingStalled: false,
    }

    it('shows the locked alert and reports the error when flag is disabled', function () {
      const reportError = cy.stub().as('reportError')
      mount({ unsavedDocsContextValue: lockedContextValue, reportError })
      cy.findByRole('alert').should('exist')
      cy.get('@reportError').should(
        'have.been.calledOnceWith',
        'connection-lost-with-unsaved-changes',
        { pendingOpsLength: 2, inflightOpsLength: 1 }
      )
    })

    it('hides the locked alert but still reports the error when flag is enabled', function () {
      const reportError = cy.stub().as('reportError')
      enableFlag()
      mount({ unsavedDocsContextValue: lockedContextValue, reportError })
      cy.findByRole('alert').should('not.exist')
      cy.get('@reportError').should(
        'have.been.calledOnceWith',
        'connection-lost-with-unsaved-changes',
        { pendingOpsLength: 2, inflightOpsLength: 1 }
      )
    })
  })
})
