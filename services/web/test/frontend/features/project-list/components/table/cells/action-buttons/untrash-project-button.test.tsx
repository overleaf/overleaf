import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import UntrashProjectButton from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/untrash-project-button'
import {
  archiveableProject,
  trashedProject,
} from '../../../../fixtures/projects-data'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../../helpers/render-with-context'

describe('<UntrashProjectButton />', function () {
  beforeEach(function () {
    fetchMock.reset()
  })

  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', function () {
    renderWithProjectListContext(
      <UntrashProjectButton project={trashedProject} />
    )
    const btn = screen.getByLabelText('Restore')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Restore' })
  })

  it('does not render the button when project is current', function () {
    renderWithProjectListContext(
      <UntrashProjectButton project={archiveableProject} />
    )
    expect(screen.queryByLabelText('Restore')).to.be.null
  })

  it('untrashes the project and updates the view data', async function () {
    const project = Object.assign({}, trashedProject)
    fetchMock.delete(
      `express:/project/${project.id}/trash`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(<UntrashProjectButton project={project} />)
    const btn = screen.getByLabelText('Restore')
    fireEvent.click(btn)

    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
  })
})
