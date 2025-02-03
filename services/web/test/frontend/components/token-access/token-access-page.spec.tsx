import '../../helpers/bootstrap-3'
import TokenAccessPage from '@/features/token-access/components/token-access-root'
import { location } from '@/shared/components/location'

describe('<TokenAccessPage/>', function () {
  // this is a URL for a read-only token, but the process is the same for read-write tokens
  const url = '/read/123/grant'

  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-postUrl', url)
      win.metaAttributesCache.set('ol-user', { email: 'test@example.com' })
    })
  })

  it('handles a successful token access request', function () {
    cy.intercept(
      { method: 'post', url, times: 1 },
      {
        body: {
          requireAccept: { projectName: 'Test Project' },
        },
      }
    ).as('grantRequest')

    cy.mount(<TokenAccessPage />)

    cy.wait('@grantRequest').then(interception => {
      expect(interception.request.body.confirmedByUser).to.be.false
    })

    cy.get('.link-sharing-invite-header').should(
      'have.text',
      ['You’re joining', 'Test Project', 'as test@example.com'].join('')
    )

    cy.intercept(
      { method: 'post', url, times: 1 },
      {
        body: {
          redirect: '/project/123',
        },
      }
    ).as('confirmedGrantRequest')

    cy.stub(location, 'replace').as('replaceLocation')

    cy.findByRole('button', { name: 'OK, join project' }).click()

    cy.wait('@confirmedGrantRequest').then(interception => {
      expect(interception.request.body.confirmedByUser).to.be.true
    })

    cy.get('@replaceLocation').should(
      'have.been.calledOnceWith',
      '/project/123'
    )
  })

  it('handles a project not found response', function () {
    cy.intercept({ method: 'post', url, times: 1 }, { statusCode: 404 }).as(
      'grantRequest'
    )

    cy.mount(<TokenAccessPage />)

    cy.wait('@grantRequest')

    cy.get('h3').should('have.text', 'Join Project')
    cy.get('h4').should('have.text', 'Project not found')

    cy.findByRole('button', { name: 'Join Project' }).should('not.exist')
  })

  it('handles a redirect response', function () {
    cy.intercept(
      { method: 'post', url, times: 1 },
      {
        body: {
          redirect: '/restricted',
        },
      }
    ).as('grantRequest')

    cy.stub(location, 'replace').as('replaceLocation')

    cy.mount(<TokenAccessPage />)

    cy.wait('@grantRequest')

    cy.get('@replaceLocation').should('have.been.calledOnceWith', '/restricted')
  })

  it('handles a v1 "must login" response', function () {
    cy.intercept(
      { method: 'post', url, times: 1 },
      {
        body: {
          v1Import: { status: 'mustLogin' },
        },
      }
    ).as('grantRequest')

    cy.stub(location, 'replace').as('replaceLocation')

    cy.mount(<TokenAccessPage />)

    cy.wait('@grantRequest')

    cy.get('h1').should('have.text', 'Please log in')

    cy.findByRole('link', { name: 'Log in to access project' })
      .should('have.attr', 'href')
      .and('match', /^\/login\?redir=/)
  })

  it('handles a v1 "cannot import" response', function () {
    cy.intercept(
      { method: 'post', url, times: 1 },
      {
        body: {
          v1Import: { status: 'cannotImport' },
        },
      }
    ).as('grantRequest')

    cy.stub(location, 'replace').as('replaceLocation')

    cy.mount(<TokenAccessPage />)

    cy.wait('@grantRequest')

    cy.get('h1').should('have.text', 'Overleaf v1 Project')
    cy.get('h2').should('have.text', 'Cannot Access Overleaf v1 Project')
  })

  it('handles a v1 "can download zip" response', function () {
    cy.intercept(
      { method: 'post', url, times: 1 },
      {
        body: {
          v1Import: {
            status: 'canDownloadZip',
            projectId: '123',
            name: 'Test Project',
          },
        },
      }
    ).as('grantRequest')

    cy.stub(location, 'replace').as('replaceLocation')

    cy.mount(<TokenAccessPage />)

    cy.wait('@grantRequest')

    cy.get('h1').should('have.text', 'Overleaf v1 Project')

    cy.findByRole('link', { name: 'Download project zip file' }).should(
      'have.attr',
      'href',
      '/overleaf/project/123/download/zip'
    )
  })
})
