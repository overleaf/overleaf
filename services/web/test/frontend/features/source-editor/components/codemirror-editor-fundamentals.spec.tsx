import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

describe('<CodeMirrorEditor/> fundamentals', function () {
  const content = `
test
`
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptSpelling()

    const scope = mockScope(content)

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodemirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-line').eq(0).click().as('first-line')
    cy.get('.cm-line').eq(1).click().as('line')
    cy.get('.cm-line').eq(2).click().as('empty-line')
  })

  it('deletes with backspace', function () {
    cy.get('@line').type('{backspace}').should('have.text', 'tes')
  })

  it('moves with arrow keys', function () {
    cy.get('@line')
      .type('{leftArrow}1')
      .should('have.text', 'tes1t')
      .type('{rightArrow}2')
      .should('have.text', 'tes1t2')
      .type('{downArrow}3')
      .type('{upArrow}{upArrow}4')
    cy.get('@empty-line').should('have.text', '3')
    cy.get('@first-line').should('have.text', '4')
  })

  it('deletes with delete', function () {
    cy.get('@line').type('{leftArrow}{del}').should('have.text', 'tes')
  })

  it('types characters', function () {
    cy.get('@empty-line')
      .type('hello codemirror!')
      .should('have.text', 'hello codemirror!')
  })

  it('replaces selections', function () {
    cy.get('@line')
      .type('{shift}{leftArrow}{leftArrow}{leftArrow}')
      .type('abby cat')
      .should('have.text', 'tabby cat')
  })

  it('inserts LaTeX commands', function () {
    cy.get('@empty-line')
      .type('\\cmd[opt]{{}arg}')
      .should('have.text', '\\cmd[opt]{arg}')
  })

  it('allows line-breaks', function () {
    cy.get('.cm-content').find('.cm-line').should('have.length', 3)
    cy.get('@empty-line').type('{enter}{enter}')
    cy.get('.cm-content').find('.cm-line').should('have.length', 5)
  })
})
