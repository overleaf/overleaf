import { isExcludedBySharding, startWith } from './helpers/config'
import { createProject } from './helpers/project'

describe('SAML', function () {
  if (isExcludedBySharding('PRO_CUSTOM_1')) return
  const samlURL = Cypress.env('SAML_URL') || 'http://saml'

  startWith({
    pro: true,
    vars: {
      EXTERNAL_AUTH: 'saml',
      OVERLEAF_SAML_ENTRYPOINT: `${samlURL}/simplesaml/saml2/idp/SSOService.php`,
      OVERLEAF_SAML_CALLBACK_URL: `${Cypress.config().baseUrl}/saml/callback`,
      OVERLEAF_SAML_ISSUER: 'sharelatex-test-saml',
      OVERLEAF_SAML_IDENTITY_SERVICE_NAME: 'SAML Test Server',
      OVERLEAF_SAML_EMAIL_FIELD: 'email',
      OVERLEAF_SAML_FIRST_NAME_FIELD: 'givenName',
      OVERLEAF_SAML_LAST_NAME_FIELD: 'sn',
      OVERLEAF_SAML_UPDATE_USER_DETAILS_ON_LOGIN: 'true',
      OVERLEAF_SAML_CERT:
        'MIIDXTCCAkWgAwIBAgIJAOvOeQ4xFTzsMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAkdCMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTYxMTE1MTQxMjU5WhcNMjYxMTE1MTQxMjU5WjBFMQswCQYDVQQGEwJHQjETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxCT6MBe5G9VoLU8MfztOEbUhnwLp17ak8eFUqxqeXkkqtWB0b/cmIBU3xoQoO3dIF8PBzfqehqfYVhrNt/TFgcmDfmJnPJRL1RJWMW3VmiP5odJ3LwlkKbZpkeT3wZ8HEJIR1+zbpxiBNkbd2GbdR1iumcsHzMYX1A2CBj+ZMV5VijC+K4P0e9c05VsDEUtLmfeAasJAiumQoVVgAe/BpiXjICGGewa6EPFI7mKkifIRKOGxdRESwZZjxP30bI31oDN0cgKqIgSJtJ9nfCn9jgBMBkQHu42WMuaWD4jrGd7+vYdX+oIfArs9aKgAH5kUGhGdew2R9SpBefrhbNxG8QIDAQABo1AwTjAdBgNVHQ4EFgQU+aSojSyyLChP/IpZcafvSdhj7KkwHwYDVR0jBBgwFoAU+aSojSyyLChP/IpZcafvSdhj7KkwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEABl3+OOVLBWMKs6PjA8lPuloWDNzSr3v76oUcHqAb+cfbucjXrOVsS9RJ0X9yxvCQyfM9FfY43DbspnN3izYhdvbJD8kKLNf0LA5st+ZxLfy0ACyL2iyAwICaqndqxAjQYplFAHmpUiu1DiHckyBPekokDJd+ze95urHMOsaGS5RWPoKJVE0bkaAeZCmEu0NNpXRSBiuxXSTeSAJfv6kyE/rkdhzUKyUl/cGQFrsVYfAFQVA+W6CKOh74ErSEzSHQQYndl7nD33snD/YqdU1ROxV6aJzLKCg+sdj+wRXSP2u/UHnM4jW9TGJfhO42jzL6WVuEvr9q4l7zWzUQKKKhtQ==',
    },
  })

  it('login', function () {
    cy.visit('/')
    cy.findByRole('link', { name: 'Log in with SAML Test Server' }).click()

    cy.origin(samlURL, () => {
      cy.get('input[name="username"]').type('sally')
      cy.get('input[name="password"]').type('sally123')
      cy.get('button[type="submit"]').click()
    })

    cy.log('wait for login to finish')
    cy.url().should('contain', '/project')

    createProject('via SAML')
  })
})

describe('LDAP', function () {
  if (isExcludedBySharding('PRO_CUSTOM_1')) return
  startWith({
    pro: true,
    vars: {
      EXTERNAL_AUTH: 'ldap',
      OVERLEAF_LDAP_URL: 'ldap://ldap:389',
      OVERLEAF_LDAP_SEARCH_BASE: 'ou=people,dc=planetexpress,dc=com',
      OVERLEAF_LDAP_SEARCH_FILTER: '(uid={{username}})',
      OVERLEAF_LDAP_BIND_DN: 'cn=admin,dc=planetexpress,dc=com',
      OVERLEAF_LDAP_BIND_CREDENTIALS: 'GoodNewsEveryone',
      OVERLEAF_LDAP_EMAIL_ATT: 'mail',
      OVERLEAF_LDAP_NAME_ATT: 'cn',
      OVERLEAF_LDAP_LAST_NAME_ATT: 'sn',
      OVERLEAF_LDAP_UPDATE_USER_DETAILS_ON_LOGIN: 'true',
    },
  })

  it('login', function () {
    cy.visit('/')
    cy.findByRole('heading', { name: 'Log in LDAP' })

    cy.findByLabelText('Username').type('fry')
    cy.findByLabelText('Password').type('fry')
    cy.findByRole('button', { name: 'Login' }).click()

    cy.log('wait for login to finish')
    cy.url().should('contain', '/project')

    createProject('via LDAP')
  })
})
