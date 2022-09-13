import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import TrashProjectButton from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/trash-project-button'
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

  it('renders tooltip for button', function () {
    renderWithProjectListContext(
      <TrashProjectButton project={archivedProject} />
    )
    const btn = screen.getByLabelText('Trash')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Trash' })
  })

  it('does not render the button when project is trashed', function () {
    renderWithProjectListContext(
      <TrashProjectButton project={trashedProject} />
    )
    expect(screen.queryByLabelText('Trash')).to.be.null
  })

  it('opens the modal and trashes the project', async function () {
    const project = Object.assign({}, archivedProject)
    fetchMock.post(
      `express:/project/${project.id}/trash`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(<TrashProjectButton project={project} />)
    const btn = screen.getByLabelText('Trash')
    fireEvent.click(btn)
    screen.getByText('Trash Projects')
    screen.getByText('You are about to trash the following projects:')
    screen.getByText('Trashing projects won’t affect your collaborators.')
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
    fireEvent.click(confirmBtn)
    expect(confirmBtn.disabled).to.be.true
    // verify trashed
    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
    const requests = fetchMock.calls()
    // first request is to get list of projects in projectlistcontext
    const [requestUrl, requestHeaders] = requests[1]
    expect(requestUrl).to.equal(`/project/${project.id}/trash`)
    expect(requestHeaders?.method).to.equal('POST')
    fetchMock.reset()
  })
})
