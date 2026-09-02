import { OnlineUsers } from '@/features/ide-react/components/toolbar/online-users'
import { EditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { OnlineUsersContext } from '@/features/ide-react/context/online-users-context'
import type { OnlineUser } from '@/features/ide-react/context/online-users-context'

const onlineUser: OnlineUser = {
  id: 'client-1',
  user_id: 'user-1',
  email: 'alice@example.com',
  name: 'alice',
  initial: 'a',
}

const mount = ({
  onlineUsersArray = [onlineUser],
}: {
  onlineUsersArray?: OnlineUser[]
} = {}) => {
  const mockOpenDoc = cy.stub().as('openDoc')
  cy.mount(
    <EditorManagerContext.Provider value={{ openDoc: mockOpenDoc } as any}>
      <OnlineUsersContext.Provider
        value={{
          onlineUsers: {},
          onlineUserCursorHighlights: {},
          onlineUsersArray,
          onlineUsersCount: onlineUsersArray.length,
        }}
      >
        <OnlineUsers />
      </OnlineUsersContext.Provider>
    </EditorManagerContext.Provider>
  )
}

describe('<OnlineUsers />', function () {
  it('renders nothing when there are no online users', function () {
    mount({ onlineUsersArray: [] })
    cy.get('.ide-redesign-online-users').should('not.exist')
  })

  it('renders the widget when there are online users', function () {
    mount()
    cy.get('.ide-redesign-online-users').should('exist')
    cy.findByText('a').should('be.visible')
  })
})
