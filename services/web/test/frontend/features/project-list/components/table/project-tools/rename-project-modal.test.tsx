import { fireEvent, screen, within } from '@testing-library/react'
import { expect } from 'chai'
import RenameProjectModal from '../../../../../../../frontend/js/features/project-list/components/modals/rename-project-modal'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../helpers/render-with-context'
import { currentProjects } from '../../../fixtures/projects-data'
import fetchMock from 'fetch-mock'

describe('<RenameProjectModal />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders the modal and validates new name', async function () {
    fetchMock.post('express:/project/:projectId/rename', {
      status: 200,
    })
    renderWithProjectListContext(
      <RenameProjectModal
        handleCloseModal={() => {}}
        showModal
        project={currentProjects[0]}
      />
    )
    screen.getByText('Rename Project')
    const input = screen.getByLabelText('New Name') as HTMLButtonElement
    expect(input.value).to.equal(currentProjects[0].name)

    const submitButton = screen.getByText('Rename') as HTMLButtonElement
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

    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
  })

  it('shows error message from API', async function () {
    fetchMock.post('express:/project/:projectId/rename', {
      status: 500,
    })
    renderWithProjectListContext(
      <RenameProjectModal
        handleCloseModal={() => {}}
        showModal
        project={currentProjects[0]}
      />
    )
    screen.getByText('Rename Project')
    const input = screen.getByLabelText('New Name') as HTMLButtonElement
    expect(input.value).to.equal(currentProjects[0].name)

    fireEvent.change(input, {
      target: { value: 'A new name' },
    })
    const modal = screen.getAllByRole('dialog')[0]
    const submitButton = within(modal).getByText('Rename') as HTMLButtonElement
    fireEvent.click(submitButton)

    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true

    screen.getByText('Something went wrong. Please try again.')
  })
})
