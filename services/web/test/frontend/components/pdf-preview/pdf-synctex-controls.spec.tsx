import PdfSynctexControls from '../../../../frontend/js/features/pdf-preview/components/pdf-synctex-controls'
import sysendTestHelper from '../../helpers/sysend'
import { cloneDeep } from 'lodash'
import { useDetachCompileContext as useCompileContext } from '../../../../frontend/js/shared/context/detach-compile-context'
import { useFileTreeData } from '../../../../frontend/js/shared/context/file-tree-data-context'
import { useEffect } from 'react'
import { mount } from '@cypress/react'
import { EditorProviders } from '../../helpers/editor-providers'
import { mockScope } from './scope'

const mockHighlights = [
  {
    page: 1,
    h: 85.03936,
    v: 509.999878,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 486.089539,
    width: 441.921265,
    height: 8.855677,
  },
]

const mockPosition = {
  page: 1,
  offset: { top: 10, left: 10 },
  pageSize: { height: 500, width: 500 },
}

const mockSelectedEntities = [{ type: 'doc' }]

const WithPosition = ({ mockPosition }) => {
  const { setPosition } = useCompileContext()

  // mock PDF scroll position update
  useEffect(() => {
    setPosition(mockPosition)
  }, [mockPosition, setPosition])

  return null
}

const WithSelectedEntities = ({ mockSelectedEntities = [] }) => {
  const { setSelectedEntities } = useFileTreeData()

  useEffect(() => {
    setSelectedEntities(mockSelectedEntities)
  }, [mockSelectedEntities, setSelectedEntities])

  return null
}
describe('<PdfSynctexControls/>', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()

    cy.interceptCompile()
    cy.interceptEvents()

    cy.intercept('/project/*/sync/code?*', {
      body: { pdf: cloneDeep(mockHighlights) },
      delay: 100,
    }).as('sync-code')

    cy.intercept('/project/*/sync/pdf?*', {
      body: { code: [{ file: 'main.tex', line: 100 }] },
      delay: 100,
    }).as('sync-pdf')
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('handles clicks on sync buttons', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
        <PdfSynctexControls />
      </EditorProviders>
    )

    cy.get('.synctex-control-icon').should('have.length', 2)

    // mock editor cursor position update
    cy.window().then(win => {
      win.dispatchEvent(
        new CustomEvent('cursor:editor:update', {
          detail: { row: 100, column: 10 },
        })
      )
    })

    cy.get('body')
      .findByRole('button', { name: 'Go to code location in PDF' })
      .click()
    cy.get('body')
      .findByRole('button', { name: 'Go to code location in PDF' })
      .should('be.disabled')

    cy.wait('@sync-code')

    cy.get('body')
      .findByRole('button', { name: /^Go to PDF location in code/ })
      .click()
    cy.get('body')
      .findByRole('button', { name: /^Go to PDF location in code/ })
      .should('be.disabled')

    cy.wait('@sync-pdf')
  })

  it('disables button when multiple entities are selected', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities
          mockSelectedEntities={[{ type: 'doc' }, { type: 'doc' }]}
        />
        <PdfSynctexControls />
      </EditorProviders>
    )

    cy.get('body')
      .findByRole('button', { name: 'Go to code location in PDF' })
      .should('be.disabled')
  })

  it('disables button when a file is selected', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities mockSelectedEntities={[{ type: 'file' }]} />
        <PdfSynctexControls />
      </EditorProviders>
    )

    cy.get('body')
      .findByRole('button', { name: 'Go to code location in PDF' })
      .should('be.disabled')
  })

  describe('with detacher role', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
    })

    it('does not have go to PDF location button nor arrow icon', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .should('not.exist')

      cy.get('.synctex-control-icon').should('not.exist')
    })

    it('send set highlights action', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </EditorProviders>
      ).then(() => {
        sysendTestHelper.resetHistory()
      })

      cy.wait('@compile')

      // mock editor cursor position update
      cy.window().then(win => {
        win.dispatchEvent(
          new CustomEvent('cursor:editor:update', {
            detail: { row: 100, column: 10 },
          })
        )
      })

      cy.findByRole('button', {
        name: 'Go to code location in PDF',
      })
        .should('not.be.disabled')
        .click()

      cy.findByRole('button', {
        name: 'Go to code location in PDF',
      }).should('be.disabled')

      cy.wait('@sync-code').should(() => {
        // synctex is called locally and the result are broadcast for the detached tab
        expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
          role: 'detacher',
          event: 'action-setHighlights',
          data: { args: [mockHighlights] },
        })
      })
    })

    it('reacts to sync to code action', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.wait('@compile').then(() => {
        sysendTestHelper.receiveMessage({
          role: 'detached',
          event: 'action-sync-to-code',
          data: {
            args: [mockPosition],
          },
        })
      })

      cy.wait('@sync-pdf')
    })
  })

  describe('with detached role', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
    })

    it('does not have go to code location button nor arrow icon', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.findByRole('button', {
        name: 'Go to code location in PDF',
      }).should('not.exist')

      cy.get('.synctex-control-icon').should('not.exist')
    })

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('send go to code line action', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.wait('@compile')

      cy.get('body').findByRole('button', {
        name: /^Go to PDF location in code/,
      })

      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .should('not.be.disabled')
        .then(() => {
          sysendTestHelper.resetHistory()
        })

      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .click()

      // the button is only disabled when the state is updated via sysend
      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .should('not.be.disabled')

      cy.get('.synctex-spin-icon')
        .should('not.exist')
        .then(() => {
          expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
            role: 'detached',
            event: 'action-sync-to-code',
            data: {
              args: [mockPosition, 72],
            },
          })
        })
    })

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('update inflight state', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </EditorProviders>
      ).then(() => {
        sysendTestHelper.receiveMessage({
          role: 'detached',
          event: 'state-has-single-selected-doc',
          data: { value: true },
        })
      })

      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .should('be.disabled')

      cy.get('.synctex-spin-icon')
        .should('not.exist')
        .then(() => {
          sysendTestHelper.receiveMessage({
            role: 'detacher',
            event: 'state-sync-to-code-inflight',
            data: { value: true },
          })
        })

      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .should('be.disabled')

      cy.get('.synctex-spin-icon')
        .should('have.length', 1)
        .then(() => {
          sysendTestHelper.receiveMessage({
            role: 'detacher',
            event: 'state-sync-to-code-inflight',
            data: { value: false },
          })
        })

      cy.get('body')
        .findByRole('button', { name: /^Go to PDF location in code/ })
        .should('not.be.disabled')

      cy.get('.synctex-spin-icon').should('not.exist')
    })
  })
})
