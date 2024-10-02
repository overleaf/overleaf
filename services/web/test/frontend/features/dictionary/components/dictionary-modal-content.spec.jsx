import DictionaryModal from '@/features/dictionary/components/dictionary-modal'
import { EditorProviders } from '../../../helpers/editor-providers'

describe('<DictionaryModalContent />', function () {
  beforeEach(function () {
    cy.interceptCompile()
  })

  afterEach(function () {
    cy.window().then(win => {
      win.dispatchEvent(new CustomEvent('learnedWords:doreset'))
    })
  })

  it('list words', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-learnedWords', ['foo', 'bar'])
      win.dispatchEvent(new CustomEvent('learnedWords:doreset'))
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
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-learnedWords', [])
      win.dispatchEvent(new CustomEvent('learnedWords:doreset'))
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

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-learnedWords', ['Foo', 'bar'])
      win.dispatchEvent(new CustomEvent('learnedWords:doreset'))
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

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-learnedWords', ['foo'])
      win.dispatchEvent(new CustomEvent('learnedWords:doreset'))
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
