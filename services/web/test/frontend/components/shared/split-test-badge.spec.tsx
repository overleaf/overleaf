import '../../helpers/bootstrap-3'
import SplitTestBadge from '../../../../frontend/js/shared/components/split-test-badge'
import { EditorProviders } from '../../helpers/editor-providers'

describe('split test badge', function () {
  it('renders an alpha badge with the url and tooltip text', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'active',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'alpha',
          badgeInfo: {
            url: '/alpha/participate',
            tooltipText: 'This is an alpha feature',
          },
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.findByRole('link', { name: /this is an alpha feature/i })
      .should('have.attr', 'href', '/alpha/participate')
      .find('.badge.alpha-badge')
  })

  it('does not render the alpha badge when user is not assigned to the variant', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'default',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'alpha',
          badgeInfo: {
            url: '/alpha/participate',
            tooltipText: 'This is an alpha feature',
          },
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.get('.badge').should('not.exist')
  })

  it('renders a beta badge with the url and tooltip text', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'active',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'beta',
          badgeInfo: {
            url: '/beta/participate',
            tooltipText: 'This is a beta feature',
          },
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.findByRole('link', { name: /this is a beta feature/i })
      .should('have.attr', 'href', '/beta/participate')
      .find('.badge.beta-badge')
  })

  it('does not render the beta badge when user is not assigned to the variant', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'default',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'beta',
          badgeInfo: {
            url: '/beta/participate',
            tooltipText: 'This is a beta feature',
          },
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.get('.badge').should('not.exist')
  })

  it('renders an info badge with the url and tooltip text', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'active',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'release',
          badgeInfo: {
            url: '/feedback/form',
            tooltipText: 'This is a new feature',
          },
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.findByRole('link', { name: /this is a new feature/i })
      .should('have.attr', 'href', '/feedback/form')
      .find('.badge.info-badge')
  })

  it('does not render the info badge when user is not assigned to the variant', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'default',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'release',
          badgeInfo: {
            url: '/feedback/form',
            tooltipText: 'This is a new feature',
          },
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.get('.badge').should('not.exist')
  })

  it('does not render the badge when no split test info is available', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'active',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {})
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.get('.badge').should('not.exist')
  })

  it('default badge url and text are used when not provided', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'cypress-test': 'active',
      })
      win.metaAttributesCache.set('ol-splitTestInfo', {
        'cypress-test': {
          phase: 'release',
        },
      })
    })

    cy.mount(
      <EditorProviders>
        <SplitTestBadge
          splitTestName="cypress-test"
          displayOnVariants={['active']}
        />
      </EditorProviders>
    )

    cy.findByRole('link', {
      name: /we are testing this new feature.*click to give feedback/i,
    })
      .should('have.attr', 'href', '/beta/participate')
      .find('.badge.info-badge')
  })
})
