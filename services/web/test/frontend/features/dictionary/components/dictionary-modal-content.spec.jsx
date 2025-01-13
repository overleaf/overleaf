import DictionaryModal from '@/features/dictionary/components/dictionary-modal'
import { EditorProviders } from '../../../helpers/editor-providers'
import { learnedWords } from '@/features/source-editor/extensions/spelling/learned-words'

describe('<DictionaryModalContent />', function () {
  let originalLearnedWords

  beforeEach(function () {
    cy.then(() => {
      originalLearnedWords = learnedWords.global
    })
    cy.interceptCompile()
  })

  afterEach(function () {
    cy.then(() => {
      learnedWords.global = originalLearnedWords
    })
  })

  it('list words', function () {
    cy.then(win => {
      learnedWords.global = new Set(['foo', 'bar'])
    })

    cy.mount(
      <EditorProviders>
        <DictionaryModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('foo')
    cy.findByText('bar')
  })

  it('shows message when empty', function () {
    cy.then(win => {
      learnedWords.global = new Set([])
    })

    cy.mount(
      <EditorProviders>
        <DictionaryModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.contains('Your custom dictionary is empty.')
  })

  it('removes words', function () {
    cy.intercept('/spelling/unlearn', { statusCode: 200 })

    cy.then(win => {
      learnedWords.global = new Set(['Foo', 'bar'])
    })

    cy.mount(
      <EditorProviders>
        <DictionaryModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('Foo')
    cy.findByText('bar')

    cy.findAllByRole('button', {
      name: 'Remove from dictionary',
    })
      .eq(0)
      .click()

    cy.findByText('bar').should('not.exist')
    cy.findByText('Foo')
  })

  it('handles errors', function () {
    cy.intercept('/spelling/unlearn', { statusCode: 500 }).as('unlearn')

    cy.then(win => {
      learnedWords.global = new Set(['foo'])
    })

    cy.mount(
      <EditorProviders>
        <DictionaryModal show handleHide={cy.stub()} />
      </EditorProviders>
    )

    cy.findByText('foo')

    cy.findAllByRole('button', {
      name: 'Remove from dictionary',
    })
      .eq(0)
      .click()

    cy.wait('@unlearn')

    cy.findByText('Sorry, something went wrong')
    cy.findByText('foo')
  })
})
