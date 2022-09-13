import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import UnarchiveProjectButton from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/unarchive-project-button'
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

  it('renders tooltip for button', function () {
    renderWithProjectListContext(
      <UnarchiveProjectButton project={archivedProject} />
    )
    const btn = screen.getByLabelText('Restore')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Restore' })
  })

  it('does not render the button when project is trashed', function () {
    renderWithProjectListContext(
      <UnarchiveProjectButton project={trashedProject} />
    )
    expect(screen.queryByLabelText('Restore')).to.be.null
  })

  it('does not render the button when project is current', function () {
    renderWithProjectListContext(
      <UnarchiveProjectButton project={archiveableProject} />
    )
    expect(screen.queryByLabelText('Restore')).to.be.null
  })

  it('unarchive the project and updates the view data', async function () {
    const project = Object.assign({}, archivedProject)
    fetchMock.delete(
      `express:/project/${project.id}/archive`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(<UnarchiveProjectButton project={project} />)
    const btn = screen.getByLabelText('Restore')
    fireEvent.click(btn)

    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
  })
})
