import GroupSettingsSSO from '../../../../../../modules/managed-users/frontend/js/components/sso/group-settings-sso'

function GroupSettingsSSOComponent() {
  return (
    <div style={{ padding: '25px', width: '600px' }}>
      <GroupSettingsSSO managedUsersEnabled />
    </div>
  )
}

const GROUP_ID = '123abc'

describe('GroupSettingsSSO', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map()
      win.metaAttributesCache.set('ol-groupId', GROUP_ID)
    })
  })

  it('renders sso settings in group management', function () {
    cy.mount(<GroupSettingsSSOComponent />)

    cy.get('.group-settings-sso').within(() => {
      cy.contains('Single Sign-On (SSO)')
      cy.contains('Enable SSO')
      cy.contains('SSO configuration')
      cy.findByRole('button', { name: 'Configure SSO' })
    })
  })

  describe('GroupSettingsSSOEnable', function () {
    it('renders without sso configuration', function () {
      cy.mount(<GroupSettingsSSOComponent />)

      cy.get('.group-settings-sso-enable').within(() => {
        cy.contains('Enable SSO')
        cy.contains(
          'Enabling SSO will make this the only sign-in option for members.'
        )
        cy.get('.switch-input').within(() => {
          cy.get('.invisible-input').should('not.be.checked')
          cy.get('.invisible-input').should('be.disabled')
        })
      })
    })

    it('renders with sso configuration', function () {
      cy.intercept('GET', `/manage/groups/${GROUP_ID}/settings/sso`, {
        statusCode: 200,
        body: {
          entryPoint: 'entrypoint',
          certificate: 'cert',
          signatureAlgorithm: 'sha1',
          userIdAttribute: 'email',
          enabled: true,
        },
      }).as('sso')

      cy.mount(<GroupSettingsSSOComponent />)

      cy.wait('@sso')

      cy.get('.group-settings-sso-enable').within(() => {
        cy.get('.switch-input').within(() => {
          cy.get('.invisible-input').should('be.checked')
          cy.get('.invisible-input').should('not.be.disabled')
        })
      })
    })

    describe('sso enable modal', function () {
      beforeEach(function () {
        cy.intercept('GET', `/manage/groups/${GROUP_ID}/settings/sso`, {
          statusCode: 200,
          body: {
            entryPoint: 'entrypoint',
            certificate: 'cert',
            signatureAlgorithm: 'sha1',
            userIdAttribute: 'email',
            enabled: false,
          },
        }).as('sso')

        cy.mount(<GroupSettingsSSOComponent />)

        cy.wait('@sso')

        cy.get('.group-settings-sso-enable').within(() => {
          cy.get('.switch-input').within(() => {
            cy.get('.invisible-input').click({ force: true })
          })
        })
      })

      it('render enable modal correctly', function () {
        // enable modal
        cy.get('.modal-dialog').within(() => {
          cy.contains('Enable single sign-on')
          cy.contains('What happens when SSO is enabled?')
        })
      })

      it('close enable modal if Cancel button is clicked', function () {
        cy.get('.modal-dialog').within(() => {
          cy.findByRole('button', { name: 'Cancel' }).click()
        })

        cy.get('.modal-dialog').should('not.exist')
      })

      it('enables SSO if Enable SSO button is clicked', function () {
        cy.intercept('POST', `/manage/groups/${GROUP_ID}/settings/enableSSO`, {
          statusCode: 200,
        }).as('enableSSO')

        cy.get('.modal-dialog').within(() => {
          cy.findByRole('button', { name: 'Enable SSO' }).click()
        })
        cy.get('.modal-dialog').should('not.exist')
        cy.get('.group-settings-sso-enable').within(() => {
          cy.get('.switch-input').within(() => {
            cy.get('.invisible-input').should('be.checked')
            cy.get('.invisible-input').should('not.be.disabled')
          })
        })
      })
    })
  })
})
