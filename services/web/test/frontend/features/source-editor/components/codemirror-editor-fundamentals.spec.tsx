import '../../../helpers/bootstrap-3'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'

describe('<CodeMirrorEditor/> fundamentals', function () {
  const content = `
test
`
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()

    const scope = mockScope(content)

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodemirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-line').eq(0).as('first-line')
    cy.get('.cm-line').eq(1).as('line')
    cy.get('.cm-line').eq(2).as('empty-line')

    cy.get('@line').click()
  })

  it('deletes with backspace', function () {
    cy.get('@line').type('{backspace}')
    cy.get('@line').should('have.text', 'tes')
  })

  it('moves with arrow keys', function () {
    cy.get('@line').type('{leftArrow}1')
    cy.get('@line').should('have.text', 'tes1t')
    cy.get('@line').type('{rightArrow}2')
    cy.get('@line').should('have.text', 'tes1t2')
    cy.get('@line').type('{downArrow}3')
    cy.get('@line').type('{upArrow}{upArrow}4')
    cy.get('@empty-line').should('have.text', '3')
    cy.get('@first-line').should('have.text', '4')
  })

  it('deletes with delete', function () {
    cy.get('@line').type('{leftArrow}{del}')
    cy.get('@line').should('have.text', 'tes')
  })

  it('types characters', function () {
    cy.get('@empty-line').type('hello codemirror!')
    cy.get('@empty-line').should('have.text', 'hello codemirror!')
  })

  it('replaces selections', function () {
    cy.get('@line').type('{shift}{leftArrow}{leftArrow}{leftArrow}')
    cy.get('@line').type('abby cat')
    cy.get('@line').should('have.text', 'tabby cat')
  })

  it('inserts LaTeX commands', function () {
    cy.get('@empty-line').type('\\cmd[opt]{{}arg}')
    cy.get('@empty-line').should('have.text', '\\cmd[opt]{arg}')
  })

  it('allows line-breaks', function () {
    cy.get('.cm-content').find('.cm-line').should('have.length', 3)
    cy.get('@empty-line').type('{enter}{enter}')
    cy.get('.cm-content').find('.cm-line').should('have.length', 5)
  })
})
