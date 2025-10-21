import Toolbar from '../../../../../frontend/js/features/history/components/diff-view/toolbar/toolbar'
import { HistoryProvider } from '../../../../../frontend/js/features/history/context/history-context'
import { HistoryContextValue } from '../../../../../frontend/js/features/history/context/types/history-context-value'
import { Diff } from '../../../../../frontend/js/features/history/services/types/doc'
import { EditorProviders } from '../../../helpers/editor-providers'
import { FC } from 'react'
import { withTestContainerErrorBoundary } from '../../../helpers/error-boundary'
import { LayoutContextValue } from '@/shared/context/layout-context'

const TestContainerWithoutErrorBoundary: FC<{
  layoutContext: LayoutContextValue
  diff: Diff
  selection: HistoryContextValue['selection']
}> = ({ diff, selection, layoutContext }) => {
  return (
    <EditorProviders layoutContext={layoutContext}>
      <HistoryProvider>
        <div className="history-react">
          <Toolbar diff={diff} selection={selection} isCurrentVersion={false} />
        </div>
      </HistoryProvider>
    </EditorProviders>
  )
}

const TestContainer = withTestContainerErrorBoundary(
  TestContainerWithoutErrorBoundary
)

describe('history toolbar', function () {
  const diff: Diff = {
    binary: false,
    docDiff: {
      highlights: [
        {
          range: {
            from: 0,
            to: 3,
          },
          hue: 1,
          type: 'addition',
          label: 'label',
        },
      ],
      doc: 'doc',
    },
  }

  it('renders viewing mode', function () {
    const selection: HistoryContextValue['selection'] = {
      updateRange: {
        fromV: 3,
        toV: 6,
        fromVTimestamp: 1681413775958,
        toVTimestamp: 1681413775958,
      },
      comparing: false,
      files: [
        {
          pathname: 'main.tex',
          operation: 'edited',
        },
        {
          pathname: 'sample.bib',
          editable: true,
        },
        {
          pathname: 'frog.jpg',
          editable: false,
        },
      ],
      selectedFile: {
        pathname: 'main.tex',
        editable: true,
      },
      previouslySelectedPathname: null,
    }

    cy.mount(
      <TestContainer
        layoutContext={{ view: 'history' }}
        diff={diff}
        selection={selection}
      />
    )

    cy.get('.history-react-toolbar').within(() => {
      cy.get('div:first-child').contains('Viewing 13th April')
    })

    cy.get('.history-react-toolbar-file-info').contains('1 change in main.tex')
  })

  it('renders comparing mode', function () {
    const selection: HistoryContextValue['selection'] = {
      updateRange: {
        fromV: 0,
        toV: 6,
        fromVTimestamp: 1681313775958,
        toVTimestamp: 1681413775958,
      },
      comparing: true,
      files: [
        {
          pathname: 'main.tex',
          operation: 'added',
          editable: true,
        },
        {
          pathname: 'sample.bib',
          operation: 'added',
          editable: true,
        },
        {
          pathname: 'frog.jpg',
          operation: 'added',
          editable: false,
        },
      ],
      selectedFile: {
        pathname: 'main.tex',
        editable: true,
      },
      previouslySelectedPathname: null,
    }

    cy.mount(
      <TestContainer
        layoutContext={{ view: 'history' }}
        diff={diff}
        selection={selection}
      />
    )

    cy.get('.history-react-toolbar').within(() => {
      cy.get('div:first-child').contains('Comparing from 12th April')

      cy.get('div:first-child').contains('to 13th April')
    })
  })
})
