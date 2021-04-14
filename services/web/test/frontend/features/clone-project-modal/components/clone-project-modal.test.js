import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import CloneProjectModal from '../../../../../frontend/js/features/clone-project-modal/components/clone-project-modal'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'

describe('<CloneProjectModal />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  const modalProps = {
    handleHide: sinon.stub(),
    projectId: 'project-1',
    projectName: 'Test Project',
    openProject: sinon.stub(),
    show: true
  }

  it('renders the translated modal title', async function () {
    render(<CloneProjectModal {...modalProps} />)

    await screen.findByText('Copy Project')
  })

  it('posts the generated project name', async function () {
    fetchMock.post(
      'express:/project/:projectId/clone',
      {
        status: 200,
        body: { project_id: modalProps.projectId }
      },
      { delay: 10 }
    )

    const openProject = sinon.stub()

    render(<CloneProjectModal {...modalProps} openProject={openProject} />)

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' })
    expect(cancelButton.disabled).to.be.false

    const submitButton = await screen.findByRole('button', { name: 'Copy' })
    expect(submitButton.disabled).to.be.false

    const input = await screen.getByLabelText('New Name')

    fireEvent.change(input, {
      target: { value: '' }
    })
    expect(submitButton.disabled).to.be.true

    fireEvent.change(input, {
      target: { value: 'A Cloned Project' }
    })
    expect(submitButton.disabled).to.be.false

    fireEvent.click(submitButton)
    expect(submitButton.disabled).to.be.true

    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
    const [url, options] = fetchMock.lastCall(
      'express:/project/:projectId/clone'
    )
    expect(url).to.equal('/project/project-1/clone')

    expect(JSON.parse(options.body)).to.deep.equal({
      projectName: 'A Cloned Project'
    })

    expect(openProject).to.be.calledOnce

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
      body: 'There was an error!'
    })

    const openProject = sinon.stub()

    render(<CloneProjectModal {...modalProps} openProject={openProject} />)

    const button = await screen.findByRole('button', { name: 'Copy' })
    expect(button.disabled).to.be.false

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' })
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)

    expect(fetchMock.done(matcher)).to.be.true
    expect(openProject).not.to.be.called

    await screen.findByText('Sorry, something went wrong')

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false
  })

  it('handles a specific error response', async function () {
    const matcher = 'express:/project/:projectId/clone'

    fetchMock.postOnce(matcher, {
      status: 400,
      body: 'There was an error!'
    })

    const openProject = sinon.stub()

    render(<CloneProjectModal {...modalProps} openProject={openProject} />)

    const button = await screen.findByRole('button', { name: 'Copy' })
    expect(button.disabled).to.be.false

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' })
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)
    await fetchMock.flush(true)

    expect(fetchMock.done(matcher)).to.be.true
    expect(openProject).not.to.be.called

    await screen.findByText('There was an error!')

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false
  })
})
