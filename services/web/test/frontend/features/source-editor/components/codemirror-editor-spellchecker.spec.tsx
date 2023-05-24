import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { FC } from 'react'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

describe('Spellchecker', function () {
  const content = `
\\documentclass{}

\\title{}
\\author{}

\\begin{document}
\\maketitle

\\begin{abstract}
\\end{abstract}

\\section{}

\\end{document}`

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()

    const scope = mockScope(content)

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-line').eq(13).as('line')
    cy.get('@line').click()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('makes initial spellcheck request', function () {
    cy.intercept('POST', '/spelling/check').as('spellCheckRequest')
    cy.get('@line').type('wombat')
    cy.wait('@spellCheckRequest')
  })

  it('makes only one spellcheck request for multiple typed characters', function () {
    let spellCheckRequestCount = 0
    cy.intercept('POST', '/spelling/check', req => {
      ++spellCheckRequestCount
      if (spellCheckRequestCount > 1) {
        throw new Error('No more than one request was expected')
      }
      req.reply({
        misspellings: [],
      })
    }).as('spellCheckRequest')

    cy.get('@line').type('wombat')
    cy.wait('@spellCheckRequest')
  })

  it('shows red underline for misspelled word', function () {
    cy.intercept('POST', '/spelling/check', {
      misspellings: [
        {
          index: 0,
          suggestions: [
            'noncombat',
            'wombat',
            'nutmeat',
            'nitwit',
            'steamboat',
            'entombed',
            'tombed',
          ],
        },
      ],
    }).as('spellCheckRequest')

    cy.get('@line').type('notawombat')
    cy.wait('@spellCheckRequest')
    cy.get('@line').get('.ol-cm-spelling-error').contains('notawombat')
  })
})
