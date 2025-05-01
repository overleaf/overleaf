import { expect } from 'chai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import { DownloadProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/download-project-button'
import { projectsData } from '../../../../fixtures/projects-data'
import { location } from '@/shared/components/location'

describe('<DownloadProjectButton />', function () {
  beforeEach(function () {
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
    render(<DownloadProjectButtonTooltip project={projectsData[0]} />)
  })

  afterEach(function () {
    this.locationWrapperSandbox.restore()
  })

  it('renders tooltip for button', async function () {
    const btn = screen.getByRole('button', { name: 'Download .zip file' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Download .zip file' })
  })

  it('downloads the project when clicked', async function () {
    const btn = screen.getByRole('button', {
      name: 'Download .zip file',
    }) as HTMLButtonElement
    fireEvent.click(btn)

    const assignStub = this.locationWrapperStub.assign
    await waitFor(() => {
      expect(assignStub).to.have.been.called
    })

    sinon.assert.calledOnce(assignStub)

    sinon.assert.calledWithMatch(
      assignStub,
      `/project/${projectsData[0].id}/download/zip`
    )
  })
})
