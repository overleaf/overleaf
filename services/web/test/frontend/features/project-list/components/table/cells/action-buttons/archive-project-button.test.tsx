import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import { ArchiveProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/archive-project-button'
import {
  archiveableProject,
  archivedProject,
} from '../../../../fixtures/projects-data'
import fetchMock from 'fetch-mock'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../../../helpers/render-with-context'

describe('<ArchiveProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', function () {
    renderWithProjectListContext(
      <ArchiveProjectButtonTooltip project={archiveableProject} />
    )
    const btn = screen.getByLabelText('Archive')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Archive' })
  })

  it('opens the modal when clicked', function () {
    renderWithProjectListContext(
      <ArchiveProjectButtonTooltip project={archiveableProject} />
    )
    const btn = screen.getByLabelText('Archive')
    fireEvent.click(btn)
    screen.getByText('Archive Projects')
    screen.getByText(archiveableProject.name)
  })

  it('does not render the button when already archived', function () {
    renderWithProjectListContext(
      <ArchiveProjectButtonTooltip project={archivedProject} />
    )
    expect(screen.queryByLabelText('Archive')).to.be.null
  })

  it('should archive the projects', async function () {
    const project = Object.assign({}, archiveableProject)
    fetchMock.post(
      `express:/project/${project.id}/archive`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(
      <ArchiveProjectButtonTooltip project={project} />
    )
    const btn = screen.getByLabelText('Archive')
    fireEvent.click(btn)
    screen.getByText('Archive Projects')
    screen.getByText('You are about to archive the following projects:')
    screen.getByText('Archiving projects won’t affect your collaborators.')
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
    fireEvent.click(confirmBtn)
    expect(confirmBtn.disabled).to.be.true
    // verify archived
    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
    const requests = fetchMock.calls()
    // first mock call is to get list of projects in projectlistcontext
    const [requestUrl, requestHeaders] = requests[1]
    expect(requestUrl).to.equal(`/project/${project.id}/archive`)
    expect(requestHeaders?.method).to.equal('POST')
    fetchMock.reset()
  })
})
