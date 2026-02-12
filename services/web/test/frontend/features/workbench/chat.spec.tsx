import { consentTutorialKey } from '@modules/workbench/frontend/js/components/chat'
import Workbench from '@modules/workbench/frontend/js/components/workbench'
import { EditorProviders } from '../../helpers/editor-providers'
import { EditorView } from '@codemirror/view'
import type { FC, PropsWithChildren } from 'react'
import { EditorViewContext } from '@/features/ide-react/context/editor-view-context'
import { TutorialProvider } from '@/shared/context/tutorial-context'

describe('Workbench', { scrollBehavior: false }, function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-showAiFeatures', true)
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'ai-workbench-release': 'enabled',
      })
      win.metaAttributesCache.set('ol-inactiveTutorials', [consentTutorialKey])
    })
  })

  const EditorViewProvider: FC<React.PropsWithChildren> = ({ children }) => (
    <EditorViewContext.Provider
      value={{
        view: new EditorView(),
        setView: cy.stub(),
      }}
    >
      {children}
    </EditorViewContext.Provider>
  )

  const Providers: FC<PropsWithChildren<{ aiAssistEnabled?: boolean }>> = ({
    children,
    aiAssistEnabled = true,
  }) => {
    return (
      <EditorProviders
        features={{ aiErrorAssistant: aiAssistEnabled }}
        providers={{ EditorViewProvider, TutorialProvider }}
      >
        <div style={{ backgroundColor: '#1b222c' }}>{children}</div>
      </EditorProviders>
    )
  }

  describe('when AI assist is enabled and consent is given', function () {
    it('should show the chat interface', function () {
      cy.mount(
        <Providers aiAssistEnabled>
          <Workbench />
        </Providers>
      )

      cy.get('textarea').should('exist').and('be.visible')
      cy.get('.conversation-footer').should('not.have.attr', 'inert')

      cy.contains('Supporting your research').should('not.exist')

      cy.contains('Get early access').should('not.exist')

      cy.contains('AI can make mistakes').should('exist')
    })
  })

  describe('when AI assist is enabled but consent not yet given', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-inactiveTutorials', [])
      })

      cy.mount(
        <Providers aiAssistEnabled>
          <Workbench />
        </Providers>
      )
    })

    it('should show consent screen', function () {
      cy.get('.workbench-consent-prompt').should('exist')
      cy.contains('Supporting your research').should('be.visible')

      cy.findByRole('button', { name: /accept and continue/i }).should('exist')

      cy.contains('Get early access').should('not.exist')

      cy.get('.conversation-footer').should('have.attr', 'inert', 'true')
    })

    it('should hide consent and show chat after accepting', function () {
      cy.intercept('POST', '/user/tutorials/*', { statusCode: 204 }).as(
        'completeTutorial'
      )
      cy.intercept('POST', '/tutorial/workbench-consent-release/complete', {
        statusCode: 205,
      }).as('completeConsentTutorial')

      cy.get('.workbench-consent-prompt').should('be.visible')

      cy.findByRole('button', { name: /accept and continue/i }).click()

      cy.wait('@completeConsentTutorial')

      cy.get('.workbench-consent-prompt').should('not.exist')
    })
  })

  describe('when AI assist is not enabled', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-showAiFeatures', false)
      })
      cy.mount(
        <Providers aiAssistEnabled={false}>
          <Workbench />
        </Providers>
      )
    })
    it('should show upgrade notification', function () {
      cy.get('.workbench-upgrade-notification').should('exist')
      cy.contains('Get early access').should('be.visible')

      cy.findByRole('button', { name: /get ai assist/i }).should('exist')

      cy.get('.workbench-consent-prompt').should('not.exist')

      cy.get('.conversation-footer').should('have.attr', 'inert', 'true')
    })

    it('should dispatch paywall event when clicking upgrade button', function () {
      const paywallSpy = cy.spy().as('paywallSpy')
      cy.window().then(win => {
        win.addEventListener('aiAssist:showPaywall', paywallSpy)
      })

      cy.findByRole('button', { name: /get ai assist/i }).click()

      // Should dispatch the paywall event
      cy.get('@paywallSpy').should('have.been.calledOnce')
    })
  })
})
