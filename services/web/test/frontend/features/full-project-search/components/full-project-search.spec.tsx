import { EditorProviders } from '../../../helpers/editor-providers'
import FullProjectSearch from '../../../../../modules/full-project-search/frontend/js/components/full-project-search'
import {
  LayoutContext,
  LayoutContextValue,
} from '@/shared/context/layout-context'
import { FC, useState } from 'react'

describe('<FullProjectSearch/>', function () {
  beforeEach(function () {
    cy.interceptCompile()

    cy.intercept('/project/*/flush', {
      statusCode: 204,
    }).as('project-history-flush')

    cy.intercept('/project/*/changes?*', {
      body: [],
    }).as('project-history-changes')

    cy.intercept('/project/*/latest/history', {
      body: { chunk: mockHistoryChunk },
    }).as('project-history-snapshot')

    cy.intercept('get', '/project/*/blob/*', req => {
      const blobId = req.url.split('/').pop() as string

      req.reply({
        fixture: `blobs/${blobId}`,
      })
    }).as('project-history-blob')
  })

  it('displays the search form', function () {
    cy.mount(
      <EditorProviders providers={{ LayoutProvider }}>
        <FullProjectSearch />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Search' })
  })

  it('displays a close button', function () {
    cy.mount(
      <EditorProviders providers={{ LayoutProvider }}>
        <FullProjectSearch />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Close' })
  })

  it('displays matched content', function () {
    cy.mount(
      <EditorProviders providers={{ LayoutProvider }}>
        <FullProjectSearch />
      </EditorProviders>
    )

    cy.findByRole('searchbox', { name: 'Search' }).type('and{enter}')

    cy.findByRole('button', { name: 'main.tex 5' }) // TODO: remove count from name?

    cy.get('.matched-file-hit').as('matches')
    cy.get('@matches').should('have.length', 5)

    cy.get('@matches').first().click()
    cy.get('@matches').first().should('have.class', 'matched-file-hit-selected')
  })
})

const createInitialValue = () =>
  ({
    reattach: cy.stub(),
    detach: cy.stub(),
    detachIsLinked: false,
    detachRole: null,
    changeLayout: cy.stub(),
    view: 'editor',
    setView: cy.stub(),
    chatIsOpen: false,
    setChatIsOpen: cy.stub(),
    reviewPanelOpen: false,
    setReviewPanelOpen: cy.stub(),
    miniReviewPanelVisible: false,
    setMiniReviewPanelVisible: cy.stub(),
    leftMenuShown: false,
    setLeftMenuShown: cy.stub(),
    loadingStyleSheet: false,
    setLoadingStyleSheet: cy.stub(),
    pdfLayout: 'flat',
    pdfPreviewOpen: false,
    projectSearchIsOpen: true,
    setProjectSearchIsOpen: cy.stub(),
    openFile: null,
    setOpenFile: cy.stub(),
    restoreView: cy.stub(),
    handleChangeLayout: cy.stub(),
    handleDetach: cy.stub(),
  }) satisfies LayoutContextValue

const LayoutProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const [value] = useState(createInitialValue)

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  )
}

const mockHistoryChunk = {
  history: {
    snapshot: {
      files: {},
    },
    changes: [
      {
        operations: [
          {
            pathname: 'main.tex',
            file: {
              hash: '5199b66d9d1226551be436c66bad9d962cc05537',
              stringLength: 7066,
            },
          },
        ],
        timestamp: '2025-01-03T10:10:40.840Z',
        authors: [],
        v2Authors: ['66e040e0da7136ec75ffe8a3'],
        projectVersion: '1.0',
      },
      {
        operations: [
          {
            pathname: 'sample.bib',
            file: {
              hash: 'a0e21c740cf81e868f158e30e88985b5ea1d6c19',
              stringLength: 244,
            },
          },
        ],
        timestamp: '2025-01-03T10:10:40.856Z',
        authors: [],
        v2Authors: ['66e040e0da7136ec75ffe8a3'],
        projectVersion: '2.0',
      },
      {
        operations: [
          {
            pathname: 'frog.jpg',
            file: {
              hash: '5b889ef3cf71c83a4c027c4e4dc3d1a106b27809',
              byteLength: 97080,
            },
          },
        ],
        timestamp: '2025-01-03T10:10:40.890Z',
        authors: [],
        v2Authors: ['66e040e0da7136ec75ffe8a3'],
        projectVersion: '3.0',
      },
    ],
  },
  startVersion: 0,
}
