import '../../../../helpers/bootstrap-3'
import UploadProjectModal from '../../../../../../frontend/js/features/project-list/components/new-project-button/upload-project-modal'

describe('<UploadProjectModal />', function () {
  const maxUploadSize = 10 * 1024 * 1024 // 10 MB

  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-ExposedSettings', { maxUploadSize })
    })
  })

  it('uploads a dropped file', function () {
    cy.intercept('post', '/project/new/upload', {
      body: { success: true, project_id: '123abc' },
    }).as('uploadProject')

    cy.mount(
      <UploadProjectModal
        onHide={cy.stub()}
        openProject={cy.stub().as('openProject')}
      />
    )

    cy.findByRole('button', {
      name: 'Select a .zip file',
    }).trigger('drop', {
      dataTransfer: {
        files: [new File(['test'], 'test.zip', { type: 'application/zip' })],
      },
    })

    cy.wait('@uploadProject')
    cy.get('@openProject').should('have.been.calledOnceWith', '123abc')
  })

  it('shows error on file type other than zip', function () {
    cy.mount(
      <UploadProjectModal
        onHide={cy.stub()}
        openProject={cy.stub().as('openProject')}
      />
    )

    cy.findByRole('button', {
      name: 'Select a .zip file',
    }).trigger('drop', {
      dataTransfer: {
        files: [new File(['test'], 'test.png', { type: 'image/png' })],
      },
    })

    cy.findByText('You can only upload: .zip')
    cy.get('@openProject').should('not.have.been.called')
  })

  it('shows error for files bigger than maxUploadSize', function () {
    cy.mount(
      <UploadProjectModal
        onHide={cy.stub()}
        openProject={cy.stub().as('openProject')}
      />
    )

    const file = new File(['test'], 'test.zip', { type: 'application/zip' })
    Object.defineProperty(file, 'size', { value: maxUploadSize + 1 })

    cy.findByRole('button', {
      name: 'Select a .zip file',
    }).trigger('drop', {
      dataTransfer: {
        files: [file],
      },
    })

    cy.findByText('test.zip exceeds maximum allowed size of 10 MB')
    cy.get('@openProject').should('not.have.been.called')
  })

  it('handles server error', function () {
    cy.intercept('post', '/project/new/upload', {
      statusCode: 422,
      body: { success: false },
    }).as('uploadProject')

    cy.mount(
      <UploadProjectModal
        onHide={cy.stub()}
        openProject={cy.stub().as('openProject')}
      />
    )

    cy.findByRole('button', {
      name: 'Select a .zip file',
    }).trigger('drop', {
      dataTransfer: {
        files: [new File(['test'], 'test.zip', { type: 'application/zip' })],
      },
    })

    cy.wait('@uploadProject')

    cy.findByText('Upload failed')
    cy.get('@openProject').should('not.have.been.called')
  })
})
