import sinon from 'sinon'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadProjectModal from '../../../../../../frontend/js/features/project-list/components/new-project-button/upload-project-modal'
import { expect } from 'chai'

describe('<UploadProjectModal />', function () {
  const originalWindowCSRFToken = window.csrfToken
  const locationStub = sinon.stub()
  const originalLocation = window.location
  const maxUploadSize = 10 * 1024 * 1024 // 10 MB

  beforeEach(function () {
    Object.defineProperty(window, 'location', {
      value: {
        assign: locationStub,
      },
    })
    window.metaAttributesCache.set('ol-ExposedSettings', {
      maxUploadSize,
    })
    window.csrfToken = 'token'
  })

  afterEach(function () {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    })
    window.metaAttributesCache = new Map()
    window.csrfToken = originalWindowCSRFToken

    locationStub.reset()
  })

  it('uploads a dropped file', async function () {
    const xhr = sinon.useFakeXMLHttpRequest()
    const requests: sinon.SinonFakeXMLHttpRequest[] = []
    xhr.onCreate = request => {
      requests.push(request)
    }

    render(<UploadProjectModal onHide={() => {}} />)

    const uploadButton = screen.getByRole('button', {
      name: 'Select a .zip file',
    })

    expect(uploadButton).not.to.be.null

    fireEvent.drop(uploadButton, {
      dataTransfer: {
        files: [new File(['test'], 'test.zip', { type: 'application/zip' })],
      },
    })

    await waitFor(() => expect(requests).to.have.length(1))

    const [request] = requests
    expect(request.url).to.equal('/project/new/upload')
    expect(request.method).to.equal('POST')

    const projectId = '123abc'
    request.respond(
      200,
      { 'Content-Type': 'application/json' },
      JSON.stringify({ success: true, project_id: projectId })
    )

    await waitFor(() => {
      sinon.assert.calledOnce(locationStub)
      sinon.assert.calledWith(locationStub, `/project/${projectId}`)
    })

    xhr.restore()
  })

  it('shows error on file type other than zip', async function () {
    render(<UploadProjectModal onHide={() => {}} />)

    const uploadButton = screen.getByRole('button', {
      name: 'Select a .zip file',
    })

    expect(uploadButton).not.to.be.null

    fireEvent.drop(uploadButton, {
      dataTransfer: {
        files: [new File(['test'], 'test.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => screen.getByText('You can only upload: .zip'))
  })

  it('shows error for files bigger than maxUploadSize', async function () {
    render(<UploadProjectModal onHide={() => {}} />)

    const uploadButton = screen.getByRole('button', {
      name: 'Select a .zip file',
    })
    expect(uploadButton).not.to.be.null

    const filename = 'test.zip'
    const file = new File(['test'], filename, { type: 'application/zip' })
    Object.defineProperty(file, 'size', { value: maxUploadSize + 1 })

    fireEvent.drop(uploadButton, {
      dataTransfer: {
        files: [file],
      },
    })

    await waitFor(() =>
      screen.getByText(`${filename} exceeds maximum allowed size of 10 MB`)
    )
  })

  it('handles server error', async function () {
    const xhr = sinon.useFakeXMLHttpRequest()
    const requests: sinon.SinonFakeXMLHttpRequest[] = []
    xhr.onCreate = request => {
      requests.push(request)
    }

    render(<UploadProjectModal onHide={() => {}} />)

    const uploadButton = screen.getByRole('button', {
      name: 'Select a .zip file',
    })
    expect(uploadButton).not.to.be.null

    fireEvent.drop(uploadButton, {
      dataTransfer: {
        files: [new File(['test'], 'test.zip', { type: 'application/zip' })],
      },
    })

    await waitFor(() => expect(requests).to.have.length(1))

    const [request] = requests
    expect(request.url).to.equal('/project/new/upload')
    expect(request.method).to.equal('POST')
    request.respond(
      422,
      { 'Content-Type': 'application/json' },
      JSON.stringify({ success: false })
    )

    await waitFor(() => {
      sinon.assert.notCalled(locationStub)
      screen.getByText('Upload failed')
    })

    xhr.restore()
  })
})
