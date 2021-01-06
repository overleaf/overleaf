import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect } from 'chai'
import CloneProjectModalContent from '../../../../../frontend/js/features/clone-project-modal/components/clone-project-modal-content'
import CloneProjectModal from '../../../../../frontend/js/features/clone-project-modal/components/clone-project-modal'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'

const cancel = sinon.stub()
const cloneProject = sinon.stub()
const handleHide = sinon.stub()

describe('<CloneProjectModal />', function() {
  afterEach(function() {
    fetchMock.reset()
  })

  it('posts the generated project name', async function() {
    const matcher = 'express:/project/:projectId/clone'

    fetchMock.postOnce(
      matcher,
      () => {
        return {
          project_id: 'test'
        }
      },
      {
        body: {
          projectName: 'A Project (Copy)'
        }
      }
    )

    render(
      <CloneProjectModal
        handleHide={handleHide}
        projectId="project-1"
        projectName="A Project"
        show
      />
    )

    const button = await screen.findByRole('button', {
      name: 'Copy',
      hidden: true // TODO: this shouldn't be needed
    })

    const cancelButton = await screen.findByRole('button', {
      name: 'Cancel',
      hidden: true // TODO: this shouldn't be needed
    })

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)

    expect(fetchMock.done(matcher)).to.be.true
    // TODO: window.location?

    const errorMessage = screen.queryByText('Sorry, something went wrong')
    expect(errorMessage).to.be.null

    expect(button.disabled).to.be.true
    expect(cancelButton.disabled).to.be.true
  })

  it('handles a generic error response', async function() {
    const matcher = 'express:/project/:projectId/clone'

    fetchMock.postOnce(matcher, {
      status: 500,
      body: 'There was an error!'
    })

    render(
      <CloneProjectModal
        handleHide={handleHide}
        projectId="project-2"
        projectName="A Project"
        show
      />
    )

    const button = await screen.findByRole('button', {
      name: 'Copy',
      hidden: true // TODO: this shouldn't be needed
    })

    const cancelButton = await screen.findByRole('button', {
      name: 'Cancel',
      hidden: true // TODO: this shouldn't be needed
    })

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)

    expect(fetchMock.done(matcher)).to.be.true

    await screen.findByText('Sorry, something went wrong')

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false
  })

  it('handles a specific error response', async function() {
    const matcher = 'express:/project/:projectId/clone'

    fetchMock.postOnce(matcher, {
      status: 400,
      body: 'There was an error!'
    })

    render(
      <CloneProjectModal
        handleHide={handleHide}
        projectId="project-3"
        projectName="A Project"
        show
      />
    )

    const button = await screen.findByRole('button', {
      name: 'Copy',
      hidden: true // TODO: this shouldn't be needed
    })

    const cancelButton = await screen.findByRole('button', {
      name: 'Cancel',
      hidden: true // TODO: this shouldn't be needed
    })

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false

    fireEvent.click(button)

    expect(fetchMock.done(matcher)).to.be.true

    await screen.findByText('There was an error!')

    expect(button.disabled).to.be.false
    expect(cancelButton.disabled).to.be.false
  })
})

describe('<CloneProjectModalContent />', function() {
  it('renders the translated modal title', async function() {
    render(
      <CloneProjectModalContent
        cloneProject={cloneProject}
        cancel={cancel}
        inFlight={false}
      />
    )

    await screen.findByText('Copy Project')
  })

  it('shows the copy button', async function() {
    render(
      <CloneProjectModalContent
        cloneProject={cloneProject}
        cancel={cancel}
        inFlight={false}
      />
    )

    const button = await screen.findByRole('button', { name: 'Copy' })

    expect(button.disabled).to.be.false
  })

  it('disables the copy button when loading', async function() {
    render(
      <CloneProjectModalContent
        cloneProject={cloneProject}
        cancel={cancel}
        inFlight
      />
    )

    const button = await screen.findByText(
      (content, element) =>
        element.nodeName === 'BUTTON' &&
        element.textContent.trim().match(/^Copying…$/)
    )

    expect(button.disabled).to.be.true
  })

  it('renders a generic error message', async function() {
    render(
      <CloneProjectModalContent
        cloneProject={cloneProject}
        cancel={cancel}
        inFlight={false}
        error
      />
    )

    await screen.findByText('Sorry, something went wrong')
  })

  it('renders a specific error message', async function() {
    render(
      <CloneProjectModalContent
        cloneProject={cloneProject}
        cancel={cancel}
        inFlight={false}
        error={{
          message: 'Uh oh!'
        }}
      />
    )

    await screen.findByText('Uh oh!')
  })

  it('displays a project name', async function() {
    render(
      <CloneProjectModalContent
        cloneProject={cloneProject}
        cancel={cancel}
        inFlight={false}
        projectName="A copy of a project"
      />
    )

    const input = await screen.getByLabelText('New Name')

    expect(input.value).to.equal('A copy of a project (Copy)')
  })
})
