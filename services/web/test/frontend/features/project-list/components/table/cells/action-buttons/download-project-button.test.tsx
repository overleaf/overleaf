import { expect } from 'chai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import { DownloadProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/download-project-button'
import { projectsData } from '../../../../fixtures/projects-data'

describe('<DownloadProjectButton />', function () {
  const originalLocation = window.location
  const locationStub = sinon.stub()

  beforeEach(function () {
    Object.defineProperty(window, 'location', {
      value: { assign: locationStub },
    })

    render(<DownloadProjectButtonTooltip project={projectsData[0]} />)
  })

  afterEach(function () {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    })
  })

  it('renders tooltip for button', function () {
    const btn = screen.getByLabelText('Download')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Download' })
  })

  it('downloads the project when clicked', async function () {
    const btn = screen.getByLabelText('Download') as HTMLButtonElement
    fireEvent.click(btn)

    await waitFor(() => {
      expect(locationStub).to.have.been.called
    })

    sinon.assert.calledOnce(locationStub)

    sinon.assert.calledWithMatch(
      locationStub,
      `/project/${projectsData[0].id}/download/zip`
    )
  })
})
