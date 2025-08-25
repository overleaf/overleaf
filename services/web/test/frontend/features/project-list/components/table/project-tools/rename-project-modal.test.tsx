import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'chai'
import RenameProjectModal from '../../../../../../../frontend/js/features/project-list/components/modals/rename-project-modal'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../helpers/render-with-context'
import { currentProjects } from '../../../fixtures/projects-data'
import fetchMock from 'fetch-mock'

describe('<RenameProjectModal />', function () {
  beforeEach(function () {
    resetProjectListContextFetch()
  })

  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders the modal and validates new name', async function () {
    const renameProjectMock = fetchMock.post(
      'express:/project/:projectId/rename',
      {
        status: 200,
      }
    )
    renderWithProjectListContext(
      <RenameProjectModal
        handleCloseModal={() => {}}
        showModal
        project={currentProjects[0]}
      />
    )
    screen.getByText('Rename Project')
    const input = screen.getByRole('textbox', {
      name: /New name/i,
    }) as HTMLInputElement
    expect(input.value).to.equal(currentProjects[0].name)

    const submitButton = screen.getByRole('button', {
      name: 'Rename',
    }) as HTMLButtonElement
    expect(submitButton.disabled).to.be.true

    fireEvent.change(input, {
      target: { value: '' },
    })
    expect(submitButton.disabled).to.be.true

    fireEvent.change(input, {
      target: { value: 'A new name' },
    })
    expect(submitButton.disabled).to.be.false

    fireEvent.click(submitButton)
    expect(submitButton.disabled).to.be.true

    await waitFor(
      () =>
        expect(
          renameProjectMock.callHistory.called(
            `/project/${currentProjects[0].id}/rename`
          )
        ).to.be.true
    )
  })

  it('shows error message from API', async function () {
    const postRenameMock = fetchMock.post(
      'express:/project/:projectId/rename',
      {
        status: 500,
      }
    )
    renderWithProjectListContext(
      <RenameProjectModal
        handleCloseModal={() => {}}
        showModal
        project={currentProjects[0]}
      />
    )
    screen.getByText('Rename Project')
    const input = screen.getByLabelText(/New name/i) as HTMLButtonElement
    expect(input.value).to.equal(currentProjects[0].name)

    fireEvent.change(input, {
      target: { value: 'A new name' },
    })
    const modal = screen.getAllByRole('dialog')[0]
    const submitButton = within(modal).getByText('Rename') as HTMLButtonElement
    fireEvent.click(submitButton)

    await waitFor(() => expect(postRenameMock.callHistory.called()).to.be.true)

    await screen.findByText('Something went wrong. Please try again.')
  })
})
