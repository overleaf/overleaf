import RenameProjectButton from '@/features/project-list/components/table/cells/action-buttons/rename-project-button'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../../helpers/render-with-context'
import { ownedProject, sharedProject } from '../../../../fixtures/projects-data'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'

// Little test jig for rendering the button
function renderWithProject(project: Project) {
  renderWithProjectListContext(
    <RenameProjectButton project={project}>
      {(text, onClick) => {
        return <button onClick={onClick}>Rename Project Button</button>
      }}
    </RenameProjectButton>
  )
}

describe('<RenameProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('opens the modal when clicked', function () {
    renderWithProject(ownedProject)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    screen.getByText('Rename Project')
    screen.getByDisplayValue(ownedProject.name)
  })

  it('does not render the button when already archived', function () {
    renderWithProject(sharedProject)
    expect(screen.queryByRole('button')).to.be.null
  })

  it('should rename the project', async function () {
    const project = Object.assign({}, ownedProject)
    const renameProjectMock = fetchMock.post(
      `express:/project/:projectId/rename`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProject(ownedProject)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    screen.getByText('Rename Project')
    const confirmBtn = screen.getByRole('button', {
      name: 'Rename',
    }) as HTMLButtonElement
    expect(confirmBtn.disabled).to.be.true
    const nameInput = screen.getByDisplayValue(ownedProject.name)
    fireEvent.change(nameInput, { target: { value: /New name/i } })
    expect(confirmBtn.disabled).to.be.false
    fireEvent.click(confirmBtn)
    expect(confirmBtn.disabled).to.be.true

    await waitFor(
      () =>
        expect(
          renameProjectMock.callHistory.called(`/project/${project.id}/rename`)
        ).to.be.true
    )
  })
})
