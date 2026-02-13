import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useEffect, useState } from 'react'
import {
  EditorProviders,
  makeTutorialProvider,
} from '../../helpers/editor-providers'

const TutorialTester = ({
  tutorial,
  failSilently,
}: {
  tutorial: string
  failSilently?: boolean
}) => {
  const {
    tryShowingPopup,
    dismissTutorial,
    checkCompletion,
    showPopup,
    completeTutorial,
  } = useTutorial(tutorial)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!checkCompletion()) {
      tryShowingPopup()
    }
  }, [checkCompletion, tryShowingPopup])

  if (error) {
    return <div>{tutorial} error</div>
  }

  if (!showPopup) {
    return null
  }

  return (
    <div>
      <p>{tutorial} active</p>
      <button onClick={() => dismissTutorial('promo-dismiss')}>Dismiss</button>
      <button
        onClick={() =>
          completeTutorial(
            { action: 'complete', event: 'promo-click' },
            { failSilently }
          ).catch(_ => {
            setError(true)
          })
        }
      >
        Complete
      </button>
    </div>
  )
}

describe('useTutorial', function () {
  beforeEach(function () {
    cy.intercept('POST', '/tutorial/test-tutorial/complete', {
      statusCode: 200,
    }).as('completeTutorial')
  })

  describe('with a tutorial that is not completed', function () {
    it('shows the popup', function () {
      cy.mount(
        <EditorProviders>
          <TutorialTester tutorial="test-tutorial" />
        </EditorProviders>
      )

      cy.findByText('test-tutorial active').should('be.visible')
    })

    it('dismisses the popup', function () {
      cy.mount(
        <EditorProviders>
          <TutorialTester tutorial="test-tutorial" />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'Dismiss' }).click()
      cy.findByText('test-tutorial active').should('not.exist')
      cy.wait('@completeTutorial')
    })

    it('completes the tutorial', function () {
      cy.mount(
        <EditorProviders>
          <TutorialTester tutorial="test-tutorial" />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'Complete' }).click()
      cy.findByText('test-tutorial active').should('not.exist')
      cy.wait('@completeTutorial')
    })
  })

  describe('with a tutorial that is already completed', function () {
    it('does not show the popup', function () {
      cy.mount(
        <EditorProviders
          providers={{
            TutorialProvider: makeTutorialProvider({
              inactiveTutorials: ['test-tutorial'],
            }),
          }}
        >
          <TutorialTester tutorial="test-tutorial" />
        </EditorProviders>
      )
      cy.findByText('test-tutorial active').should('not.exist')
    })
  })

  describe('with a tutorial that fails to complete', function () {
    it('fails silently by default', function () {
      cy.intercept('POST', '/tutorial/test-tutorial/complete', {
        statusCode: 500,
      }).as('completeTutorialFailure')

      cy.mount(
        <EditorProviders>
          <TutorialTester tutorial="test-tutorial" />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'Complete' }).click()
      cy.findByText('test-tutorial active').should('not.exist')
      cy.wait('@completeTutorialFailure')
    })

    it('throws an error if failSilently is set to false', function () {
      cy.intercept('POST', '/tutorial/test-tutorial/complete', {
        statusCode: 500,
      }).as('completeTutorialFailure')

      cy.mount(
        <EditorProviders>
          <TutorialTester tutorial="test-tutorial" failSilently={false} />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'Complete' }).click()
      cy.wait('@completeTutorialFailure')
      cy.findByText('test-tutorial error').should('be.visible')
      cy.findByText('test-tutorial active').should('not.exist')
    })
  })

  describe('for two tutorials at the same time', function () {
    // FIXME: This should work, but doesn't.
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('only shows one popup at a time', function () {
      cy.mount(
        <EditorProviders>
          <TutorialTester tutorial="test-tutorial-1" />
          <TutorialTester tutorial="test-tutorial-2" />
        </EditorProviders>
      )

      cy.findAllByText(/active/).should('have.length', 1)
    })
  })
})
