import ChatPane from '@/features/chat/components/chat-pane'
import {
  EditorProviders,
  makeProjectProvider,
  USER_ID,
  USER_EMAIL,
} from '../../../helpers/editor-providers'
import { mockProject } from '../../source-editor/helpers/mock-project'

describe('<MessageContent /> editing', function () {
  const message = {
    id: 'msg_1',
    content: 'hello world',
    user: {
      id: USER_ID,
      first_name: 'Test',
      last_name: 'User',
      email: USER_EMAIL,
    },
    timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
  }

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'chat-edit-delete': 'enabled',
    })

    cy.intercept('GET', '/project/*/messages*', [message]).as('getMessages')
    cy.intercept('POST', '/project/*/messages/msg_1/edit', {}).as('editMessage')

    cy.mount(
      <EditorProviders
        providers={{ ProjectProvider: makeProjectProvider(mockProject()) }}
      >
        <ChatPane />
      </EditorProviders>
    )

    cy.wait('@getMessages')
    cy.findByText('hello world')
  })

  function openEditor() {
    cy.get('.message-dropdown-menu-btn').click({ force: true })
    cy.findByText('Edit').click({ force: true })
    return cy.findByRole('textbox', { name: 'Edit message' })
  }

  it('saves an edited message on Enter', function () {
    openEditor().type('{selectAll}edited message{enter}', { force: true })

    cy.wait('@editMessage')
      .its('request.body.content')
      .should('equal', 'edited message')
  })

  it('saves an edited message with the Save button', function () {
    openEditor().type('{selectAll}edited message', { force: true })
    cy.findByRole('button', { name: 'Save' }).click({ force: true })

    cy.wait('@editMessage')
      .its('request.body.content')
      .should('equal', 'edited message')
  })

  it('cancels editing on Escape without saving', function () {
    openEditor().type('{selectAll}discarded{esc}', { force: true })

    // Editor closes and the original message is shown again.
    cy.findByRole('textbox', { name: 'Edit message' }).should('not.exist')
    cy.findByText('hello world').should('exist')
    cy.get('@editMessage.all').should('have.length', 0)
  })

  it('cancels editing with the Cancel button', function () {
    openEditor().type('{selectAll}discarded', { force: true })
    cy.findByRole('button', { name: 'Cancel' }).click({ force: true })

    cy.findByRole('textbox', { name: 'Edit message' }).should('not.exist')
    cy.findByText('hello world').should('exist')
    cy.get('@editMessage.all').should('have.length', 0)
  })
})
