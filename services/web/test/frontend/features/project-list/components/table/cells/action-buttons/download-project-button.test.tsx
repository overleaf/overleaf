import { expect } from 'chai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import { DownloadProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/download-project-button'
import { projectsData } from '../../../../fixtures/projects-data'
import * as useLocationModule from '../../../../../../../../frontend/js/shared/hooks/use-location'

describe('<DownloadProjectButton />', function () {
  let assignStub: sinon.SinonStub

  beforeEach(function () {
    assignStub = sinon.stub()
    this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
      assign: assignStub,
      replace: sinon.stub(),
      reload: sinon.stub(),
      setHash: sinon.stub(),
    })
    render(<DownloadProjectButtonTooltip project={projectsData[0]} />)
  })

  afterEach(function () {
    this.locationStub.restore()
  })

  it('renders tooltip for button', function () {
    const btn = screen.getByRole('button', { name: 'Download .zip file' })
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Download .zip file' })
  })

  it('downloads the project when clicked', async function () {
    const btn = screen.getByRole('button', {
      name: 'Download .zip file',
    }) as HTMLButtonElement
    fireEvent.click(btn)

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
