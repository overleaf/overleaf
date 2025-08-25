import { fireEvent, screen, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import { expect } from 'chai'
import ActionsCopyProject from '../../../../../frontend/js/features/editor-left-menu/components/actions-copy-project'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { location } from '@/shared/components/location'

describe('<ActionsCopyProject />', function () {
  beforeEach(function () {
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  afterEach(function () {
    this.locationWrapperSandbox.restore()
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct modal when clicked', async function () {
    renderWithEditorContext(<ActionsCopyProject />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy project' }))

    screen.getByLabelText(/New name/i)
  })

  it('loads the project page when submitted', async function () {
    fetchMock.post('express:/project/:id/clone', {
      status: 200,
      body: {
        project_id: 'new-project',
      },
    })

    renderWithEditorContext(<ActionsCopyProject />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy project' }))

    const input = screen.getByLabelText(/New name/i)
    fireEvent.change(input, { target: { value: 'New project' } })

    const button = screen.getByRole('button', { name: 'Copy' })
    button.click()

    await waitFor(() => {
      expect(button.textContent).to.equal('Copying…')
    })

    const assignStub = this.locationWrapperStub.assign
    await waitFor(() => {
      expect(assignStub).to.have.been.calledOnceWith('/project/new-project')
    })
  })
})
