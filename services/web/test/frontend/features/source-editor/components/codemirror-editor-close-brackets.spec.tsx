import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'

describe('close brackets', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()

    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-line').eq(20).as('active-line')
    cy.get('@active-line').click()
  })

  describe('unprefixed characters', function () {
    it('auto-closes a curly bracket', function () {
      cy.get('@active-line').type('{{}')
      cy.get('@active-line').should('have.text', '{}')
      cy.get('@active-line').type('{backspace}')
      cy.get('@active-line').should('have.text', '')
    })

    it('auto-closes a square bracket', function () {
      cy.get('@active-line').type('[')
      cy.get('@active-line').should('have.text', '[]')
      cy.get('@active-line').type('{backspace}')
      cy.get('@active-line').should('have.text', '')
    })

    it('does not auto-close a round bracket', function () {
      cy.get('@active-line').type('(')
      cy.get('@active-line').should('have.text', '(')
    })

    it('auto-closes a dollar sign', function () {
      cy.get('@active-line').type('$')
      cy.get('@active-line').should('have.text', '$$')
      cy.get('@active-line').type('{backspace}')
      cy.get('@active-line').should('have.text', '')
    })

    it('auto-closes another dollar sign', function () {
      cy.get('@active-line').type('$$')
      cy.get('@active-line').should('have.text', '$$$$')
      cy.get('@active-line').type('{backspace}{backspace}')
      cy.get('@active-line').should('have.text', '')
    })

    it('avoids creating an odd number of adjacent dollar signs', function () {
      cy.get('@active-line').type('$2')
      cy.get('@active-line').should('have.text', '$2$')
      cy.get('@active-line').type('{leftArrow}$')
      cy.get('@active-line').should('have.text', '$$2$')
    })
  })

  describe('prefixed characters', function () {
    it('auto-closes a backslash-prefixed round bracket', function () {
      cy.get('@active-line').type('\\(')
      cy.get('@active-line').should('have.text', '\\(\\)')
    })

    it('auto-closes a backslash-prefixed square bracket', function () {
      cy.get('@active-line').type('\\[')
      cy.get('@active-line').should('have.text', '\\[\\]')
    })

    it('does not auto-close a backslash-prefixed curly bracket', function () {
      cy.get('@active-line').type('\\{{}')
      cy.get('@active-line').should('have.text', '\\{')
    })

    it('does not auto-close a backslash-prefixed dollar sign', function () {
      cy.get('@active-line').type('\\$')
      cy.get('@active-line').should('have.text', '\\$')
    })
  })

  describe('double-prefixed characters', function () {
    it('auto-closes a double-backslash-prefixed square bracket with a square bracket', function () {
      cy.get('@active-line').type('\\\\[')
      cy.get('@active-line').should('have.text', '\\\\[]')
    })

    it('auto-closes a double-backslash-prefixed curly bracket with a curly bracket', function () {
      cy.get('@active-line').type('\\\\{')
      cy.get('@active-line').should('have.text', '\\\\{}')
    })

    it('auto-closes a double-backslash-prefixed dollar sign with a dollar sign', function () {
      cy.get('@active-line').type('\\\\$')
      cy.get('@active-line').should('have.text', '\\\\$$')
    })

    it('does not auto-close a double-backslash-prefixed round bracket', function () {
      cy.get('@active-line').type('\\\\(')
      cy.get('@active-line').should('have.text', '\\\\(')
    })
  })

  describe('adjacent characters', function () {
    it('does auto-close a dollar sign before punctuation', function () {
      cy.get('@active-line').type(':2')
      cy.get('@active-line').type('{leftArrow}{leftArrow}$')
      cy.get('@active-line').should('have.text', '$$:2')
    })

    it('does auto-close a dollar sign after punctuation', function () {
      cy.get('@active-line').type('2:')
      cy.get('@active-line').type('$')
      cy.get('@active-line').should('have.text', '2:$$')
    })

    it('does not auto-close a dollar sign before text', function () {
      cy.get('@active-line').type('2')
      cy.get('@active-line').type('{leftArrow}$')
      cy.get('@active-line').should('have.text', '$2')
    })

    it('does not auto-close a dollar sign after text', function () {
      cy.get('@active-line').type('2')
      cy.get('@active-line').type('$')
      cy.get('@active-line').should('have.text', '2$')
    })

    it('does not auto-close a dollar sign before a command', function () {
      cy.get('@active-line').type('\\nu')
      cy.get('@active-line').type('{leftArrow}{leftArrow}{leftArrow}$')
      cy.get('@active-line').should('have.text', '$\\nu')
    })

    it('does auto-close a dollar sign before a newline', function () {
      cy.get('@active-line').type('\\\\')
      cy.get('@active-line').type('{leftArrow}{leftArrow}$')
      cy.get('@active-line').should('have.text', '$$\\\\')
    })

    it('does auto-close a curly bracket before punctuation', function () {
      cy.get('@active-line').type(':2')
      cy.get('@active-line').type('{leftArrow}{leftArrow}{{}')
      cy.get('@active-line').should('have.text', '{}:2')
    })

    it('does auto-close a curly bracket after punctuation', function () {
      cy.get('@active-line').type('2:')
      cy.get('@active-line').type('{{}')
      cy.get('@active-line').should('have.text', '2:{}')
    })

    it('does not auto-close a curly bracket before text', function () {
      cy.get('@active-line').type('2')
      cy.get('@active-line').type('{leftArrow}{{}')
      cy.get('@active-line').should('have.text', '{2')
    })

    it('does auto-close a curly bracket after text', function () {
      cy.get('@active-line').type('2')
      cy.get('@active-line').type('{{}')
      cy.get('@active-line').should('have.text', '2{}')
    })

    it('does auto-close $$ before punctuation', function () {
      cy.get('@active-line').type(':2')
      cy.get('@active-line').type('{leftArrow}{leftArrow}$$')
      cy.get('@active-line').should('have.text', '$$$$:2')
    })

    it('does not auto-close $$ before text', function () {
      cy.get('@active-line').type('2')
      cy.get('@active-line').type('{leftArrow}$$')
      cy.get('@active-line').should('have.text', '$$2')
    })
  })

  describe('closed brackets', function () {
    it('does type over a closing dollar sign', function () {
      cy.get('@active-line').type('$2$')
      cy.get('@active-line').should('have.text', '$2$')
    })

    it('does type over two closing dollar signs', function () {
      cy.get('@active-line').type('$$2$$')
      cy.get('@active-line').should('have.text', '$$2$$')
    })

    it('does type over a closing curly bracket', function () {
      cy.get('@active-line').type('{{}2}')
      cy.get('@active-line').should('have.text', '{2}')
    })

    it('does type over a closing square bracket', function () {
      cy.get('@active-line').type('[2]')
      cy.get('@active-line').should('have.text', '[2]')
    })
  })
})
