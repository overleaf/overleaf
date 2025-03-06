import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'
import { isMac } from '@/shared/utils/os'

describe('Cursor and active line highlight', function () {
  const content = `line 1

${'long line '.repeat(200)}`

  function assertIsFullLineHeight($item: JQuery<HTMLElement>) {
    cy.get('@line').then($line => {
      expect(Math.round($item.outerHeight()!)).to.equal(
        Math.round($line.outerHeight()!)
      )
    })
  }

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
  })

  it('has cursor', function () {
    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()

    cy.get('.cm-cursor').as('cursor')

    cy.get('.cm-cursor').then(assertIsFullLineHeight)
  })

  it('has cursor on empty line whose height is the same as the line', function () {
    // Put the cursor on a blank line
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()

    cy.get('.cm-cursor').as('cursor')

    cy.get('@cursor').then(assertIsFullLineHeight)
  })

  it('has cursor on non-empty line whose height is the same as the line', function () {
    // Put the cursor on a blank line
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type('wombat')

    cy.get('.cm-cursor').as('cursor')

    cy.get('@cursor').then(assertIsFullLineHeight)
  })

  it('puts cursor in the correct place inside brackets', function () {
    // Put the cursor on a blank line
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type('[{Enter}')

    // Get the line inside the bracket
    cy.get('.cm-line').eq(2).as('line')

    // Check that the middle of the cursor is within the line boundaries
    cy.get('.cm-cursor').then($cursor => {
      cy.get('@line').then($line => {
        const cursorCentreY = $cursor.offset()!.top + $cursor.outerHeight()! / 2
        const lineTop = $line.offset()!.top
        const lineBottom = lineTop + $line.outerHeight()!
        expect(cursorCentreY).to.be.within(lineTop, lineBottom)
      })
    })
  })

  it('has active line highlight line decoration of same height as line when there is no selection and line does not wrap', function () {
    // Put the cursor on a blank line
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()

    cy.get('.cm-content .cm-activeLine').as('highlight')
    cy.get('.ol-cm-activeLineLayer .cm-activeLine').should('not.exist')

    cy.get('@highlight').then(assertIsFullLineHeight)
  })

  it('has active line highlight layer decoration of same height as non-wrapped line when there is no selection and line wraps', function () {
    // Put the cursor on a blank line
    cy.get('.cm-line').eq(2).as('line')
    cy.get('@line').click()

    cy.get('.ol-cm-activeLineLayer .cm-activeLine').as('highlight')
    cy.get('.cm-content .cm-activeLine').should('not.exist')

    cy.get('.cm-line').eq(1).as('line')

    cy.get('@highlight').then(assertIsFullLineHeight)
  })

  it('has no active line highlight when there is a selection', function () {
    // Put the cursor on a blank line
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type(isMac ? '{cmd}A' : '{ctrl}A')

    cy.get('.cm-activeLine').should('not.exist')
  })
})
