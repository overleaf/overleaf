import WordCountModal from '@/features/word-count-modal/components/word-count-modal'
import { EditorProviders } from '../../../helpers/editor-providers'

describe('<WordCountModal />', function () {
  beforeEach(function () {
    cy.interceptCompile()
  })

  it('renders the translated modal title', function () {
    cy.intercept('/project/*/wordcount*', {
      body: { texcount: { messages: 'This is a test' } },
    })

    cy.mount(
      <EditorProviders projectId="project-1">
        <WordCountModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('Word count')
    cy.findByText(/something went wrong/).should('not.exist')
  })

  it('renders a loading message when loading', function () {
    const { promise, resolve } = Promise.withResolvers<void>()

    cy.intercept('/project/*/wordcount*', async req => {
      await promise
      req.reply({ texcount: { messages: 'This is a test' } })
    })

    cy.mount(
      <EditorProviders projectId="project-1">
        <WordCountModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('Loading…').then(() => {
      resolve()
    })

    cy.findByText('This is a test')
  })

  it('renders an error message and hides loading message on error', function () {
    cy.intercept('/project/*/wordcount?*', {
      statusCode: 500,
    })

    cy.mount(
      <EditorProviders projectId="project-1">
        <WordCountModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('Sorry, something went wrong')

    cy.findByText('Loading').should('not.exist')
  })

  it('displays messages', function () {
    cy.intercept('/project/*/wordcount*', {
      body: { texcount: { messages: 'This is a test' } },
    })

    cy.mount(
      <EditorProviders projectId="project-1">
        <WordCountModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('This is a test')
  })

  it('displays counts data', function () {
    cy.intercept('/project/*/wordcount*', {
      body: {
        texcount: {
          textWords: 500,
          headWords: 100,
          outside: 200,
          mathDisplay: 2,
          mathInline: 3,
          headers: 4,
        },
      },
    })

    cy.mount(
      <EditorProviders projectId="project-1">
        <WordCountModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText((content, element) => {
      return /^Total Words\s*:\s*500$/.test(element!.textContent!.trim())
    })

    cy.findByText((content, element) => {
      return /^Math Display\s*:\s*2$/.test(element!.textContent!.trim())
    })

    cy.findByText((content, element) => {
      return /^Math Inline\s*:\s*3$/.test(element!.textContent!.trim())
    })

    cy.findByText((content, element) => {
      return /^Headers\s*:\s*4$/.test(element!.textContent!.trim())
    })
  })
})
