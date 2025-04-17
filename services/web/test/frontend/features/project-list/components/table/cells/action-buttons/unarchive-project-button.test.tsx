import { expect } from 'chai'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { UnarchiveProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/unarchive-project-button'
import {
  archiveableProject,
  archivedProject,
  trashedProject,
} from '../../../../fixtures/projects-data'
import fetchMock from 'fetch-mock'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../../../helpers/render-with-context'

describe('<UnarchiveProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', async function () {
    renderWithProjectListContext(
      <UnarchiveProjectButtonTooltip project={archivedProject} />
    )
    const btn = screen.getByRole('button', { name: 'Restore' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Restore' })
  })

  it('does not render the button when project is trashed', function () {
    renderWithProjectListContext(
      <UnarchiveProjectButtonTooltip project={trashedProject} />
    )
    expect(screen.queryByRole('button', { name: 'Restore' })).to.be.null
  })

  it('does not render the button when project is current', function () {
    renderWithProjectListContext(
      <UnarchiveProjectButtonTooltip project={archiveableProject} />
    )
    expect(screen.queryByRole('button', { name: 'Restore' })).to.be.null
  })

  it('unarchive the project and updates the view data', async function () {
    const project = Object.assign({}, archivedProject)
    const unarchiveProjectMock = fetchMock.delete(
      `express:/project/:projectId/archive`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(
      <UnarchiveProjectButtonTooltip project={project} />
    )
    const btn = screen.getByRole('button', { name: 'Restore' })
    fireEvent.click(btn)

    await waitFor(
      () =>
        expect(
          unarchiveProjectMock.callHistory.called(
            `/project/${project.id}/archive`
          )
        ).to.be.true
    )
  })
})
