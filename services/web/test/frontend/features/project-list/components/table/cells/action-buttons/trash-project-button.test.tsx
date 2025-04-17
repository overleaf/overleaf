import { expect } from 'chai'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { TrashProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/trash-project-button'
import {
  archivedProject,
  trashedProject,
} from '../../../../fixtures/projects-data'
import fetchMock from 'fetch-mock'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../../helpers/render-with-context'

describe('<TrashProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', async function () {
    renderWithProjectListContext(
      <TrashProjectButtonTooltip project={archivedProject} />
    )
    const btn = screen.getByRole('button', { name: 'Trash' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Trash' })
  })

  it('does not render the button when project is trashed', function () {
    renderWithProjectListContext(
      <TrashProjectButtonTooltip project={trashedProject} />
    )
    expect(screen.queryByRole('button', { name: 'Trash' })).to.be.null
  })

  it('opens the modal and trashes the project', async function () {
    const project = Object.assign({}, archivedProject)
    const trashProjectMock = fetchMock.post(
      `express:/project/:projectId/trash`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(
      <TrashProjectButtonTooltip project={project} />
    )
    const btn = screen.getByRole('button', { name: 'Trash' })
    fireEvent.click(btn)
    screen.getByText('Trash Projects')
    screen.getByText('You are about to trash the following projects:')
    screen.getByText('Trashing projects won’t affect your collaborators.')
    const confirmBtn = screen.getByRole('button', {
      name: 'Confirm',
    }) as HTMLButtonElement
    fireEvent.click(confirmBtn)
    expect(confirmBtn.disabled).to.be.true

    await waitFor(
      () =>
        expect(
          trashProjectMock.callHistory.called(`/project/${project.id}/trash`)
        ).to.be.true
    )
  })
})
