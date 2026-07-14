import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import { UnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { GlobalAlertsProvider } from '@/features/ide-react/context/global-alerts-context'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

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

const mount = () => {
  cy.mount(
    <SplitTestProvider>
      <GlobalAlertsProvider>
        <ConnectionContext.Provider value={mockConnectionContextValue}>
          <FileTreePathContext.Provider value={mockFileTreePathContextValue}>
            <UnsavedDocsContext.Provider value={defaultUnsavedDocsContextValue}>
              <UnsavedDocs />
            </UnsavedDocsContext.Provider>
          </FileTreePathContext.Provider>
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
})
