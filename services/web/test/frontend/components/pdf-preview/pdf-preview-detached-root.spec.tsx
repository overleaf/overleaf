import sysendTestHelper from '../../helpers/sysend'
import PdfPreviewDetachedRoot from '../../../../frontend/js/features/pdf-preview/components/pdf-preview-detached-root'
import { User } from '../../../../types/user'

describe('<PdfPreviewDetachedRoot/>', function () {
  beforeEach(function () {
    window.user = { id: 'user1' } as User

    window.metaAttributesCache = new Map<string, unknown>([
      ['ol-user', window.user],
      ['ol-project_id', 'project1'],
      ['ol-detachRole', 'detached'],
      ['ol-projectName', 'Project Name'],
    ])

    cy.interceptCompile()
    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
  })

  it('syncs compiling state', function () {
    cy.mount(<PdfPreviewDetachedRoot />).then(() => {
      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'connected',
      })

      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'state-compiling',
        data: { value: true },
      })
    })

    cy.findByRole('button', { name: 'Compiling…' })
    cy.findByRole('button', { name: 'Recompile' })
      .should('not.exist')
      .then(() => {
        sysendTestHelper.receiveMessage({
          role: 'detacher',
          event: 'state-compiling',
          data: { value: false },
        })
      })
    cy.findByRole('button', { name: 'Recompile' })
    cy.findByRole('button', { name: 'Compiling…' }).should('not.exist')
  })

  it('sends a clear cache request when the button is pressed', function () {
    cy.mount(<PdfPreviewDetachedRoot />).then(() => {
      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'state-showLogs',
        data: { value: true },
      })
    })

    cy.findByRole('button', { name: 'Clear cached files' })
      .should('not.be.disabled')
      .click()
      .should(() => {
        expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
          role: 'detached',
          event: 'action-clearCache',
          data: {
            args: [],
          },
        })
      })
  })
})
