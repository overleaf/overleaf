import PdfSynctexControls from '../../../../frontend/js/features/pdf-preview/components/pdf-synctex-controls'
import { cloneDeep } from 'lodash'
import { useDetachCompileContext as useCompileContext } from '../../../../frontend/js/shared/context/detach-compile-context'
import { useFileTreeData } from '../../../../frontend/js/shared/context/file-tree-data-context'
import { useEffect } from 'react'
import {
  EditorProviders,
  makeEditorOpenDocProvider,
} from '../../helpers/editor-providers'
import { mockScope } from './scope'
import { detachChannel, testDetachChannel } from '../../helpers/detach-channel'
import { FindResult } from '@/features/file-tree/util/path'

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

type Position = {
  page: number
  offset: { top: number; left: number }
  pageSize: { height: number; width: number }
}

const mockPosition: Position = {
  page: 1,
  offset: { top: 10, left: 10 },
  pageSize: { height: 500, width: 500 },
}

const mockSelectedEntities = [{ type: 'doc' }] as FindResult[]

const WithPosition = ({ mockPosition }: { mockPosition: Position }) => {
  const { setPosition } = useCompileContext()

  // mock PDF scroll position update
  useEffect(() => {
    setPosition(mockPosition)
  }, [mockPosition, setPosition])

  return null
}

// mock PDF scroll position update
const setDetachedPosition = (mockPosition: Position) => {
  testDetachChannel.postMessage({
    role: 'detacher',
    event: 'state-position',
    data: { value: mockPosition },
  })
}

const WithSelectedEntities = ({
  mockSelectedEntities = [],
}: {
  mockSelectedEntities: FindResult[]
}) => {
  const { setSelectedEntities } = useFileTreeData()

  useEffect(() => {
    setSelectedEntities(mockSelectedEntities)
  }, [mockSelectedEntities, setSelectedEntities])

  return null
}

function mockProviders() {
  return {
    EditorOpenDocProvider: makeEditorOpenDocProvider({
      openDocName: 'main.tex',
      currentDocumentId: null,
      currentDocument: {
        doc_id: 'test-doc',
        getSnapshot: () => 'some doc content',
        hasBufferedOps: () => false,
        on: () => {},
        off: () => {},
        leaveAndCleanUpPromise: () => Promise.resolve(),
      } as any,
    }),
  }
}

describe('<PdfSynctexControls/>', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-project_id', 'test-project')
    window.metaAttributesCache.set('ol-preventCompileOnLoad', false)
    cy.interceptEvents()
  })

  it('handles clicks on sync buttons', function () {
    cy.interceptCompile()

    const scope = mockScope()
    const providers = mockProviders()

    cy.mount(
      <EditorProviders scope={scope} providers={providers}>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
        <PdfSynctexControls />
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.get('.synctex-control-icon').should('have.length', 2)

    // mock editor cursor position update
    cy.window().then(win => {
      win.dispatchEvent(
        new CustomEvent('cursor:editor:update', {
          detail: { row: 100, column: 10 },
        })
      )
    })

    cy.wrap(null).then(() => {
      setDetachedPosition(mockPosition)
    })

    cy.interceptAsync({ pathname: '/project/*/sync/code' }, 'sync-code').then(
      syncCodeResponse => {
        cy.findByRole('button', { name: 'Go to code location in PDF' }).click()
        cy.findByRole('button', { name: 'Go to code location in PDF' })
          .should('be.disabled')
          .then(() => {
            syncCodeResponse.resolve({
              body: { pdf: cloneDeep(mockHighlights) },
            })
          })

        cy.wait('@sync-code')
      }
    )

    cy.interceptAsync({ pathname: '/project/*/sync/pdf' }, 'sync-pdf').then(
      syncPdfResponse => {
        cy.findByRole('button', { name: /^Go to PDF location in code/ }).click()
        cy.findByRole('button', { name: /^Go to PDF location in code/ })
          .should('be.disabled')
          .then(() => {
            syncPdfResponse.resolve({
              body: { code: [{ file: 'main.tex', line: 100 }] },
            })
          })

        cy.wait('@sync-pdf')
      }
    )
  })

  it('disables button when multiple entities are selected', function () {
    cy.interceptCompile()

    const scope = mockScope()
    const providers = mockProviders()

    cy.mount(
      <EditorProviders scope={scope} providers={providers}>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities
          mockSelectedEntities={
            [{ type: 'doc' }, { type: 'doc' }] as FindResult[]
          }
        />
        <PdfSynctexControls />
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.findByRole('button', { name: 'Go to code location in PDF' }).should(
      'be.disabled'
    )
  })

  it('disables button when a file is selected', function () {
    cy.interceptCompile()

    const scope = mockScope()
    const providers = mockProviders()

    cy.mount(
      <EditorProviders scope={scope} providers={providers}>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities
          mockSelectedEntities={[{ type: 'fileRef' }] as FindResult[]}
        />
        <PdfSynctexControls />
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.findByRole('button', { name: 'Go to code location in PDF' }).should(
      'be.disabled'
    )
  })

  describe('with detacher role', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
    })

    it('does not have go to PDF location button nor arrow icon', function () {
      cy.interceptCompile()

      const scope = mockScope()
      const providers = mockProviders()

      cy.mount(
        <EditorProviders scope={scope} providers={providers}>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.waitForCompile()

      cy.findByRole('button', { name: /^Go to PDF location in code/ }).should(
        'not.exist'
      )

      cy.get('.synctex-control-icon').should('not.exist')
    })

    it('send set highlights action', function () {
      cy.interceptCompile()

      const scope = mockScope()
      const providers = mockProviders()

      cy.mount(
        <EditorProviders scope={scope} providers={providers}>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.waitForCompile()

      // mock editor cursor position update
      cy.window().then(win => {
        win.dispatchEvent(
          new CustomEvent('cursor:editor:update', {
            detail: { row: 100, column: 10 },
          })
        )
      })

      cy.spy(detachChannel, 'postMessage').as('postDetachMessage')

      cy.interceptAsync({ pathname: '/project/*/sync/code' }, 'sync-code').then(
        syncCodeResponse => {
          cy.findByRole('button', {
            name: 'Go to code location in PDF',
          })
            .should('not.be.disabled')
            .click()

          cy.findByRole('button', {
            name: 'Go to code location in PDF',
          })
            .should('be.disabled')
            .then(() => {
              syncCodeResponse.resolve({
                body: { pdf: cloneDeep(mockHighlights) },
              })
            })

          cy.wait('@sync-code')
        }
      )

      cy.findByRole('button', {
        name: 'Go to code location in PDF',
      }).should('not.be.disabled')

      // synctex is called locally and the result are broadcast for the detached tab
      // NOTE: can't use `.to.deep.include({…})` as it doesn't match the nested array
      cy.get('@postDetachMessage').should('have.been.calledWith', {
        role: 'detacher',
        event: 'action-setHighlights',
        data: { args: [mockHighlights] },
      })
    })

    it('reacts to sync to code action', function () {
      cy.interceptCompile()

      const scope = mockScope()
      const providers = mockProviders()

      cy.mount(
        <EditorProviders scope={scope} providers={providers}>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.waitForCompile()

      cy.interceptAsync({ pathname: '/project/*/sync/pdf' }, 'sync-pdf')
        .then(syncPdfResponse => {
          syncPdfResponse.resolve({
            body: { code: [{ file: 'main.tex', line: 100 }] },
          })

          testDetachChannel.postMessage({
            role: 'detached',
            event: 'action-sync-to-code',
            data: {
              args: [mockPosition],
            },
          })
        })
        .wait('@sync-pdf')
    })
  })

  describe('with detached role', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
    })

    it('does not have go to code location button nor arrow icon', function () {
      cy.interceptCompile()

      const scope = mockScope()
      const providers = mockProviders()

      cy.mount(
        <EditorProviders scope={scope} providers={providers}>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.waitForCompile()

      cy.findByRole('button', {
        name: 'Go to code location in PDF',
      }).should('not.exist')

      cy.get('.synctex-control-icon').should('not.exist')
    })

    it('send go to code line action', function () {
      cy.interceptCompile()

      const scope = mockScope()
      const providers = mockProviders()

      cy.mount(
        <EditorProviders scope={scope} providers={providers}>
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.waitForCompile().then(() => {
        testDetachChannel.postMessage({
          role: 'detacher',
          event: `state-position`,
          data: { value: mockPosition },
        })
      })

      cy.findByRole('button', {
        name: /^Go to PDF location in code/,
      })

      cy.findByRole('button', { name: /^Go to PDF location in code/ }).should(
        'not.be.disabled'
      )

      cy.spy(detachChannel, 'postMessage').as('postDetachMessage')

      cy.findByRole('button', { name: /^Go to PDF location in code/ }).click()

      // the button is only disabled when the state is updated
      cy.findByRole('button', { name: /^Go to PDF location in code/ }).should(
        'not.be.disabled'
      )

      cy.get('.synctex-spin-icon').should('not.exist')

      cy.get('@postDetachMessage').should('have.been.calledWith', {
        role: 'detached',
        event: 'action-sync-to-code',
        data: {
          args: [{ visualOffset: 72 }],
        },
      })
    })

    it('update inflight state', function () {
      cy.interceptCompile()

      const scope = mockScope()
      const providers = mockProviders()

      cy.mount(
        <EditorProviders scope={scope} providers={providers}>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </EditorProviders>
      )

      cy.waitForCompile().then(() => {
        testDetachChannel.postMessage({
          role: 'detacher',
          event: `state-position`,
          data: { value: mockPosition },
        })
      })

      cy.findByRole('button', { name: /^Go to PDF location in code/ }).should(
        'not.be.disabled'
      )

      cy.findByTestId('ol-spinner').should('not.exist')

      cy.wrap(null).then(() => {
        testDetachChannel.postMessage({
          role: 'detacher',
          event: 'state-sync-to-code-inflight',
          data: { value: true },
        })
      })

      cy.findByRole('button', { name: /^Go to PDF location in code/ }).should(
        'be.disabled'
      )

      cy.findByTestId('ol-spinner').should('have.length', 1)

      cy.wrap(null).then(() => {
        testDetachChannel.postMessage({
          role: 'detacher',
          event: 'state-sync-to-code-inflight',
          data: { value: false },
        })
      })

      cy.findByRole('button', { name: /^Go to PDF location in code/ }).should(
        'not.be.disabled'
      )

      cy.get('.synctex-spin-icon').should('not.exist')
    })
  })
})
