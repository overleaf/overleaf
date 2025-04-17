import { expect } from 'chai'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { UntrashProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/untrash-project-button'
import {
  archiveableProject,
  trashedProject,
} from '../../../../fixtures/projects-data'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../../helpers/render-with-context'

describe('<UntrashProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', async function () {
    renderWithProjectListContext(
      <UntrashProjectButtonTooltip project={trashedProject} />
    )
    const btn = screen.getByRole('button', { name: 'Restore' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Restore' })
  })

  it('does not render the button when project is current', function () {
    renderWithProjectListContext(
      <UntrashProjectButtonTooltip project={archiveableProject} />
    )
    expect(screen.queryByRole('button', { name: 'Restore' })).to.be.null
  })

  it('untrashes the project and updates the view data', async function () {
    const project = Object.assign({}, trashedProject)
    const untrashProjectMock = fetchMock.delete(
      `express:/project/:projectId/trash`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(
      <UntrashProjectButtonTooltip project={project} />
    )
    const btn = screen.getByRole('button', { name: 'Restore' })
    fireEvent.click(btn)

    await waitFor(
      () =>
        expect(
          untrashProjectMock.callHistory.called(`/project/${project.id}/trash`)
        ).to.be.true
    )
  })
})
