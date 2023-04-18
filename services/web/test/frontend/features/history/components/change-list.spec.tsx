import { useState } from 'react'
import ToggleSwitch from '../../../../../frontend/js/features/history/components/change-list/toggle-switch'
import ChangeList from '../../../../../frontend/js/features/history/components/change-list/change-list'
import { EditorProviders } from '../../../helpers/editor-providers'
import { HistoryProvider } from '../../../../../frontend/js/features/history/context/history-context'
import { updates } from '../fixtures/updates'
import { labels } from '../fixtures/labels'

const mountChangeList = (scope: Record<string, unknown> = {}) => {
  cy.mount(
    <EditorProviders scope={scope}>
      <HistoryProvider>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="history-react">
            <ChangeList />
          </div>
        </div>
      </HistoryProvider>
    </EditorProviders>
  )
}

describe('change list', function () {
  describe('toggle switch', function () {
    it('renders switch buttons', function () {
      cy.mount(<ToggleSwitch labelsOnly={false} setLabelsOnly={() => {}} />)

      cy.findByLabelText(/all history/i)
      cy.findByLabelText(/labels/i)
    })

    it('toggles "all history" and "labels" buttons', function () {
      function ToggleSwitchWrapped({ labelsOnly }: { labelsOnly: boolean }) {
        const [labelsOnlyLocal, setLabelsOnlyLocal] = useState(labelsOnly)
        return (
          <ToggleSwitch
            labelsOnly={labelsOnlyLocal}
            setLabelsOnly={setLabelsOnlyLocal}
          />
        )
      }

      cy.mount(<ToggleSwitchWrapped labelsOnly={false} />)

      cy.findByLabelText(/all history/i).as('all-history')
      cy.findByLabelText(/labels/i).as('labels')
      cy.get('@all-history').should('be.checked')
      cy.get('@labels').should('not.be.checked')
      cy.get('@labels').click({ force: true })
      cy.get('@all-history').should('not.be.checked')
      cy.get('@labels').should('be.checked')
    })
  })

  describe('tags', function () {
    const scope = {
      ui: { view: 'history', pdfLayout: 'sideBySide', chatOpen: true },
    }

    const waitForData = () => {
      cy.wait('@updates')
      cy.wait('@labels')
      cy.wait('@diff')
    }

    beforeEach(function () {
      cy.intercept('GET', '/project/*/updates*', {
        body: updates,
      }).as('updates')
      cy.intercept('GET', '/project/*/labels', {
        body: labels,
      }).as('labels')
      cy.intercept('GET', '/project/*/filetree/diff*', {
        body: { diff: [{ pathname: 'main.tex' }, { pathname: 'name.tex' }] },
      }).as('diff')
    })

    it('renders tags', function () {
      mountChangeList(scope)
      waitForData()

      cy.findByLabelText(/all history/i).click({ force: true })
      cy.findAllByTestId('history-version-details').as('details')
      cy.get('@details').should('have.length', 3)
      // 1st details entry
      cy.get('@details')
        .eq(0)
        .within(() => {
          cy.findAllByTestId('history-version-badge').as('tags')
        })
      cy.get('@tags').should('have.length', 2)
      cy.get('@tags').eq(0).should('contain.text', 'tag-2')
      cy.get('@tags').eq(1).should('contain.text', 'tag-1')
      // should have delete buttons
      cy.get('@tags').each(tag =>
        cy.wrap(tag).within(() => {
          cy.findByRole('button', { name: /delete/i })
        })
      )
      // 2nd details entry
      cy.get('@details')
        .eq(1)
        .within(() => {
          cy.findAllByTestId('history-version-badge').as('tags')
        })
      cy.get('@tags').should('have.length', 2)
      cy.get('@tags').eq(0).should('contain.text', 'tag-4')
      cy.get('@tags').eq(1).should('contain.text', 'tag-3')
      // should not have delete buttons
      cy.get('@tags').each(tag =>
        cy.wrap(tag).within(() => {
          cy.findByRole('button', { name: /delete/i }).should('not.exist')
        })
      )
      // 3rd details entry
      cy.get('@details')
        .eq(2)
        .within(() => {
          cy.findAllByTestId('history-version-badge').should('have.length', 0)
        })
      cy.findByLabelText(/labels/i).click({ force: true })
      cy.findAllByTestId('history-version-details').as('details')
      cy.get('@details').should('have.length', 2)
      cy.get('@details')
        .eq(0)
        .within(() => {
          cy.findAllByTestId('history-version-badge').as('tags')
        })
      cy.get('@tags').should('have.length', 2)
      cy.get('@tags').eq(0).should('contain.text', 'tag-2')
      cy.get('@tags').eq(1).should('contain.text', 'tag-1')
      cy.get('@details')
        .eq(1)
        .within(() => {
          cy.findAllByTestId('history-version-badge').as('tags')
        })
      cy.get('@tags').should('have.length', 3)
      cy.get('@tags').eq(0).should('contain.text', 'tag-5')
      cy.get('@tags').eq(1).should('contain.text', 'tag-4')
      cy.get('@tags').eq(2).should('contain.text', 'tag-3')
    })

    it('deletes tag', function () {
      mountChangeList(scope)
      waitForData()

      cy.findByLabelText(/all history/i).click({ force: true })

      const labelToDelete = 'tag-2'
      cy.findAllByTestId('history-version-details').eq(0).as('details')
      cy.get('@details').within(() => {
        cy.findAllByTestId('history-version-badge').eq(0).as('tag')
      })
      cy.get('@tag').should('contain.text', labelToDelete)
      cy.get('@tag').within(() => {
        cy.findByRole('button', { name: /delete/i }).as('delete-btn')
      })
      cy.get('@delete-btn').click()
      cy.findByRole('dialog').as('modal')
      cy.get('@modal').within(() => {
        cy.findByRole('heading', { name: /delete label/i })
      })
      cy.get('@modal').contains(
        new RegExp(
          `are you sure you want to delete the following label "${labelToDelete}"?`,
          'i'
        )
      )
      cy.get('@modal').within(() => {
        cy.findByRole('button', { name: /cancel/i }).click()
      })
      cy.findByRole('dialog').should('not.exist')
      cy.get('@delete-btn').click()
      cy.findByRole('dialog').as('modal')
      cy.intercept('DELETE', '/project/*/labels/*', {
        statusCode: 500,
      }).as('delete')
      cy.get('@modal').within(() => {
        cy.findByRole('button', { name: /delete/i }).click()
      })
      cy.wait('@delete')
      cy.get('@modal').within(() => {
        cy.findByRole('alert').within(() => {
          cy.contains(/sorry, something went wrong/i)
        })
      })
      cy.intercept('DELETE', '/project/*/labels/*', {
        statusCode: 204,
      }).as('delete')
      cy.get('@modal').within(() => {
        cy.findByRole('button', { name: /delete/i }).click()
      })
      cy.wait('@delete')
      cy.findByText(labelToDelete).should('not.exist')
    })
  })
})
