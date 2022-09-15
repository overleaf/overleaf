import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import CopyProjectButton from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/copy-project-button'
import {
  archivedProject,
  copyableProject,
  trashedProject,
} from '../../../../fixtures/projects-data'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../../helpers/render-with-context'
import fetchMock from 'fetch-mock'

describe('<CopyProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })
  it('renders tooltip for button', function () {
    renderWithProjectListContext(
      <CopyProjectButton project={copyableProject} />
    )
    const btn = screen.getByLabelText('Copy')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Copy' })
  })

  it('does not render the button when project is archived', function () {
    renderWithProjectListContext(
      <CopyProjectButton project={archivedProject} />
    )
    expect(screen.queryByLabelText('Copy')).to.be.null
  })

  it('does not render the button when project is trashed', function () {
    renderWithProjectListContext(<CopyProjectButton project={trashedProject} />)
    expect(screen.queryByLabelText('Copy')).to.be.null
  })

  it('opens the modal and copies the project ', async function () {
    fetchMock.post(
      `express:/project/${copyableProject.id}/clone`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(
      <CopyProjectButton project={copyableProject} />
    )
    const btn = screen.getByLabelText('Copy')
    fireEvent.click(btn)
    screen.getByText('Copy Project')
    screen.getByLabelText('New Name')
    screen.getByDisplayValue(`${copyableProject.name} (Copy)`)
    const copyBtn = screen.getByText('Copy') as HTMLButtonElement
    fireEvent.click(copyBtn)
    expect(copyBtn.disabled).to.be.true
    // verify cloned
    await fetchMock.flush(true)
    expect(fetchMock.done()).to.be.true
    const requests = fetchMock.calls()
    // first mock call is to get list of projects in projectlistcontext
    const [requestUrl, requestHeaders] = requests[1]
    expect(requestUrl).to.equal(`/project/${copyableProject.id}/clone`)
    expect(requestHeaders?.method).to.equal('POST')
    fetchMock.reset()
  })
})
