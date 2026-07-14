import { Alerts } from '@/features/ide-react/components/alerts/alerts'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { GlobalAlertsProvider } from '@/features/ide-react/context/global-alerts-context'
import { ProjectContext } from '@/shared/context/project-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { makeTutorialProvider } from '../../../../helpers/make-tutorial-provider'

const TutorialProvider = makeTutorialProvider()

const disconnectedConnectionContextValue = {
  socket: { socket: {} },
  connectionState: {
    forceDisconnected: true,
    readyState: WebSocket.CLOSED,
    error: '',
  },
  isConnected: false,
  isStillReconnecting: false,
  secondsUntilReconnect: () => 0,
  tryReconnectNow: () => {},
  registerUserActivity: () => {},
  closeConnection: () => {},
  getSocketDebuggingInfo: () => ({ id: '' }),
} as any

const projectContextValue = {
  project: { imageName: 'texlive-full:2023.1' },
} as any

const mount = () => {
  cy.mount(
    <SplitTestProvider>
      <TutorialProvider>
        <ProjectContext.Provider value={projectContextValue}>
          <GlobalAlertsProvider>
            <ConnectionContext.Provider
              value={disconnectedConnectionContextValue}
            >
              <Alerts />
            </ConnectionContext.Provider>
          </GlobalAlertsProvider>
        </ProjectContext.Provider>
      </TutorialProvider>
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

describe('<Alerts />', function () {
  it('shows the connection alert when flag is disabled', function () {
    mount()
    cy.findByRole('alert').should('exist')
  })

  it('suppresses the connection alert when flag is enabled', function () {
    enableFlag()
    mount()
    cy.findByRole('alert').should('not.exist')
  })
})
