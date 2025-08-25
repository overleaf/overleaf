import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import EditorCloneProjectModalWrapper from '../../../../../frontend/js/features/clone-project-modal/components/editor-clone-project-modal-wrapper'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<EditorCloneProjectModalWrapper />', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  after(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  const contextProps = {
    projectId: 'project-1',
    projectName: 'Test Project',
  }

  it('renders the translated modal title', async function () {
    const handleHide = sinon.stub()
    const openProject = sinon.stub()

    renderWithEditorContext(
      <EditorCloneProjectModalWrapper
        handleHide={handleHide}
        openProject={openProject}
        show
      />,
      contextProps
    )

    await screen.findByText('Copy project')
  })

  it('posts the generated project name', async function () {
    fetchMock.post(
      'express:/project/:projectId/clone',
      {
        status: 200,
        body: { project_id: 'cloned-project' },
      },
      { delay: 10 }
    )

    const handleHide = sinon.stub()
    const openProject = sinon.stub()

    renderWithEditorContext(
      <EditorCloneProjectModalWrapper
        handleHide={handleHide}
        openProject={openProject}
        show
      />,
      contextProps
    )

    const cancelButton: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Cancel',
    })
    expect(cancelButton.disabled).to.be.false

    const submitButton: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Copy',
    })
    expect(submitButton.disabled).to.be.false

    const input = await screen.getByLabelText(/New name/i)

    fireEvent.change(input, {
      target: { value: '' },
    })
    expect(submitButton.disabled).to.be.true

    fireEvent.change(input, {
      target: { value: 'A Cloned Project' },
    })
    expect(submitButton.disabled).to.be.false

    fireEvent.click(submitButton)
    expect(submitButton.disabled).to.be.true

    await fetchMock.callHistory.flush(true)
    expect(fetchMock.callHistory.done()).to.be.true

    const callLog = fetchMock.callHistory
      .calls('express:/project/:projectId/clone')
      .at(-1)

    expect(callLog).to.exist

    const { url, options } = callLog!
    expect(url).to.equal(
      'https://www.test-overleaf.com/project/project-1/clone'
    )

    expect(options.body).to.exist

    expect(JSON.parse(options.body as string)).to.deep.equal({
      projectName: 'A Cloned Project',
      tags: [],
    })

    await waitFor(() => {
      expect(openProject).to.be.calledOnce
    })

    const errorMessage = screen.queryByText('Sorry, something went wrong')
    expect(errorMessage).to.be.null

    await waitFor(() => {
      expect(submitButton.disabled).to.be.false
      expect(cancelButton.disabled).to.be.false
    })
  })

  it('handles a generic error response', async function () {
    const matcher = 'express:/project/:projectId/clone'

    fetchMock.postOnce(matcher, {
      status: 500,
      body: 'There was an error!',
    })

    const handleHide = sinon.stub()
    const openProject = sinon.stub()

    renderWithEditorContext(
      <EditorCloneProjectModalWrapper
        handleHide={handleHide}
        openProject={openProject}
        show
      />,
      contextProps
    )

    const button: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Copy',
    })
    expect(button.disabled).to.be.false

    const cancelButton: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Cancel',
    })
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)

    expect(fetchMock.callHistory.done(matcher)).to.be.true
    expect(openProject).not.to.be.called

    await screen.findByText('Sorry, something went wrong')

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false
  })

  it('handles a specific error response', async function () {
    const matcher = 'express:/project/:projectId/clone'

    fetchMock.postOnce(matcher, {
      status: 400,
      body: 'There was an error!',
    })

    const handleHide = sinon.stub()
    const openProject = sinon.stub()

    renderWithEditorContext(
      <EditorCloneProjectModalWrapper
        handleHide={handleHide}
        openProject={openProject}
        show
      />,
      contextProps
    )

    const button: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Copy',
    })
    expect(button.disabled).to.be.false

    const cancelButton: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Cancel',
    })
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)
    await fetchMock.callHistory.flush(true)

    expect(fetchMock.callHistory.done(matcher)).to.be.true
    expect(openProject).not.to.be.called

    await screen.findByText('There was an error!')

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false
  })
})
