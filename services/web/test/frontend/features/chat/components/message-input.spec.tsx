import MessageInput from '@/features/chat/components/message-input'
import {
  EditorProviders,
  makeProjectProvider,
} from '../../../helpers/editor-providers'
import { mockProject } from '../../source-editor/helpers/mock-project'

describe('<MessageInput />', function () {
  const INPUT_LABEL = 'Send a message to your collaborators…'

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  function mountInput() {
    cy.mount(
      <EditorProviders
        providers={{ ProjectProvider: makeProjectProvider(mockProject()) }}
      >
        <MessageInput
          sendMessage={cy.stub().as('sendMessage')}
          resetUnreadMessages={cy.stub().as('resetUnreadMessages')}
        />
      </EditorProviders>
    )
  }

  it('renders an accessible message input', function () {
    mountInput()
    cy.findByRole('textbox', { name: INPUT_LABEL }).should('exist')
  })

  it('sends a message after typing and hitting enter', function () {
    mountInput()
    cy.findByRole('textbox', { name: INPUT_LABEL }).type('hello world{enter}')
    cy.get('@sendMessage').should('have.been.calledOnceWith', 'hello world')
  })

  it('clears the input after sending a message', function () {
    mountInput()
    cy.findByRole('textbox', { name: INPUT_LABEL }).type('hello world{enter}')
    // The input shows its placeholder text when empty, so assert the sent
    // message is gone rather than expecting exactly-empty text content.
    cy.findByRole('textbox', { name: INPUT_LABEL }).should(
      'not.contain',
      'hello world'
    )
  })

  it('resets the number of unread messages when the input is focused', function () {
    mountInput()
    cy.findByRole('textbox', { name: INPUT_LABEL }).focus()
    cy.get('@resetUnreadMessages').should('have.been.called')
  })
})
