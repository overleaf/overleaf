import Toolbar from '../../../../../frontend/js/features/history/components/diff-view/toolbar'
import { HistoryContextValue } from '../../../../../frontend/js/features/history/context/types/history-context-value'
import { Diff } from '../../../../../frontend/js/features/history/services/types/doc'

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
        },
        {
          pathname: 'frog.jpg',
        },
      ],
      pathname: 'main.tex',
    }

    cy.mount(
      <div className="history-react">
        <Toolbar diff={diff} selection={selection} />
      </div>
    )

    cy.get('.history-react-toolbar').within(() => {
      cy.get('div:first-child').contains('Viewing 13th April')
    })

    cy.get('.history-react-toolbar-changes').contains('1 change in main.tex')
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
        },
        {
          pathname: 'sample.bib',
          operation: 'added',
        },
        {
          pathname: 'frog.jpg',
          operation: 'added',
        },
      ],
      pathname: 'main.tex',
    }

    cy.mount(
      <div className="history-react">
        <Toolbar diff={diff} selection={selection} />
      </div>
    )

    cy.get('.history-react-toolbar').within(() => {
      cy.get('div:first-child').contains('Comparing 12th April')

      cy.get('div:first-child').contains('to 13th April')
    })
  })
})
