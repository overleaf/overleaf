import AiPaywallNotification from '@/shared/components/ai-paywall-notification'
import { AiFeatureLocations } from '@/shared/components/types/ai'
import {
  EditorProviders,
  makeEditorProvider,
  USER_EMAIL,
  USER_ID,
  type EditorProvidersProps,
} from '../../helpers/editor-providers'

type User = Partial<NonNullable<EditorProvidersProps['user']>>

const futureDate = () => new Date(Date.now() + 60 * 60 * 1000)

// These fixtures carry no planCode, so plan-type is the only thing identifying
// them in the event.
const COMMONS_USER: User = { hasInstitutionLicence: true }

const GROUP_USER: User = { isMemberOfGroupSubscription: true }

const ADD_ON_USER: User = { planCode: 'professional' }

const FAIR_USE_TITLE = 'Usage limit reached'

function mountPaywall({
  user = {},
  hasUnlimitedAi = false,
  featureLocation = 'errorAssist',
  isVisible = true,
}: {
  user?: User
  hasUnlimitedAi?: boolean
  featureLocation?: AiFeatureLocations
  isVisible?: boolean
} = {}) {
  cy.window().then(win => {
    win.metaAttributesCache.set('ol-showAiFeatures', true)
    win.metaAttributesCache.set('ol-hasUnlimitedAi', hasUnlimitedAi)
    win.metaAttributesCache.get('ol-ExposedSettings').isOverleaf = true
  })

  cy.mount(
    <EditorProviders
      user={{ id: USER_ID, email: USER_EMAIL, ...user }}
      providers={{
        EditorProvider: makeEditorProvider({
          hasSuggestionsLeft: false,
          hasTokensLeft: false,
          premiumSuggestionResetDate: futureDate(),
          tokenResetDate: futureDate(),
        }),
      }}
    >
      <AiPaywallNotification
        featureLocation={featureLocation}
        isVisible={isVisible}
      />
    </EditorProviders>
  )
}

describe('<AiPaywallNotification />', function () {
  beforeEach(function () {
    cy.intercept('POST', '/event/ai-usage-limit-show', { statusCode: 204 }).as(
      'limitShown'
    )
    cy.intercept('POST', '/event/paywall-prompt', { statusCode: 204 }).as(
      'paywallPrompt'
    )
  })

  it('reports ai-usage-limit-show for a commons user', function () {
    mountPaywall({ user: COMMONS_USER })

    cy.wait('@limitShown').then(({ request }) => {
      expect(request.body).to.deep.include({
        'paywall-type': 'assistant',
        'plan-type': 'commons',
      })
      expect(request.body).not.to.have.property('plan-code')
    })
  })

  // A commons entitlement can grant unlimited AI, which renders the fair-use
  // copy. The user is still commons and must be reported as such.
  it('reports a commons user as commons when their plan grants unlimited AI', function () {
    mountPaywall({
      user: COMMONS_USER,
      hasUnlimitedAi: true,
      featureLocation: 'workbench',
    })

    cy.contains(FAIR_USE_TITLE).should('be.visible')
    cy.wait('@limitShown').then(({ request }) => {
      expect(request.body).to.deep.include({
        'paywall-type': 'workbench',
        'plan-type': 'commons',
      })
    })
  })

  it('reports ai-usage-limit-show for a group member', function () {
    mountPaywall({ user: GROUP_USER })

    cy.wait('@limitShown').then(({ request }) => {
      expect(request.body).to.deep.include({
        'paywall-type': 'assistant',
        'plan-type': 'group',
      })
      expect(request.body).not.to.have.property('plan-code')
    })
  })

  it('reports ai-usage-limit-show for a user on the AI add-on', function () {
    mountPaywall({
      user: ADD_ON_USER,
      hasUnlimitedAi: true,
      featureLocation: 'workbench',
    })

    cy.wait('@limitShown').then(({ request }) => {
      expect(request.body).to.deep.include({
        'paywall-type': 'workbench',
        'plan-code': 'professional',
        'plan-type': 'individual',
      })
    })
  })

  it('reports paywall-prompt, not ai-usage-limit-show, when an upgrade is offered', function () {
    mountPaywall({ user: { planCode: 'personal' } })

    cy.wait('@paywallPrompt')
    cy.get('@limitShown.all').should('have.length', 0)
  })

  // The workbench rail and its tab panes stay mounted while hidden, so the
  // banner exists long before anyone sees it.
  it('does not report a limit message the user cannot see', function () {
    mountPaywall({
      user: COMMONS_USER,
      featureLocation: 'workbench',
      hasUnlimitedAi: true,
      isVisible: false,
    })

    cy.contains(FAIR_USE_TITLE).should('be.visible')
    cy.get('@limitShown.all').should('have.length', 0)
  })

  it('does not report a paywall prompt the user cannot see', function () {
    mountPaywall({
      user: { planCode: 'personal' },
      featureLocation: 'workbench',
      isVisible: false,
    })

    // Proves the upgrade variant rendered, so the absent event is the gate
    // rather than the component having taken some other branch.
    cy.findByRole('link', { name: 'Upgrade' }).should('be.visible')
    cy.get('@paywallPrompt.all').should('have.length', 0)
  })

  it('reports nothing for a commons user in the workbench, where no message is shown', function () {
    mountPaywall({ user: COMMONS_USER, featureLocation: 'workbench' })

    cy.contains('You’ve reached your AI usage limit').should('not.exist')
    cy.get('@limitShown.all').should('have.length', 0)
    cy.get('@paywallPrompt.all').should('have.length', 0)
  })
})
