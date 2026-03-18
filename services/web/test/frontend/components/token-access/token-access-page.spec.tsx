import TokenAccessPage from '@/features/token-access/components/token-access-root'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { location } from '@/shared/components/location'

describe('<TokenAccessPage/>', function () {
  // this is a URL for a read-only token, but the process is the same for read-write tokens
  const url = '/read/123/grant'

  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-postUrl', url)
      win.metaAttributesCache.set('ol-user', { email: 'test@example.com' })
      win.metaAttributesCache.set('ol-splitTestVariants', {
        'sharing-updates': 'enabled',
      })
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

    cy.mount(
      <SplitTestProvider>
        <TokenAccessPage />
      </SplitTestProvider>
    )

    cy.wait('@grantRequest').then(interception => {
      expect(interception.request.body.confirmedByUser).to.be.false
    })

    cy.findByRole('heading', {
      name: /you’re joining Test Project as test@example.com/i,
    })
    cy.findByText(
      /your name and email address will be visible to project editors/i
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

    cy.findByRole('button', { name: /join project/i }).click()

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

    cy.mount(
      <SplitTestProvider>
        <TokenAccessPage />
      </SplitTestProvider>
    )

    cy.wait('@grantRequest')

    cy.findByRole('heading', { name: /sorry, this project isn’t available/i })
    cy.findByText(/the link may be broken or you may not have access rights/i)
    cy.findByRole('button', { name: 'Join Project' }).should('not.exist')
    cy.contains(
      new RegExp(
        'you are currently logged in as test@example.com. ' +
          'you might need to log in with a different email address',
        'i'
      )
    )
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

    cy.mount(
      <SplitTestProvider>
        <TokenAccessPage />
      </SplitTestProvider>
    )

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

    cy.mount(
      <SplitTestProvider>
        <TokenAccessPage />
      </SplitTestProvider>
    )

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

    cy.mount(
      <SplitTestProvider>
        <TokenAccessPage />
      </SplitTestProvider>
    )

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

    cy.mount(
      <SplitTestProvider>
        <TokenAccessPage />
      </SplitTestProvider>
    )

    cy.wait('@grantRequest')

    cy.get('h1').should('have.text', 'Overleaf v1 Project')

    cy.findByRole('link', { name: 'Download project zip file' }).should(
      'have.attr',
      'href',
      '/overleaf/project/123/download/zip'
    )
  })
})
