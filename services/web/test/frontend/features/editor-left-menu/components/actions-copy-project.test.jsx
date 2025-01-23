import { fireEvent, screen, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import { expect } from 'chai'
import ActionsCopyProject from '../../../../../frontend/js/features/editor-left-menu/components/actions-copy-project'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import * as useLocationModule from '../../../../../frontend/js/shared/hooks/use-location'

describe('<ActionsCopyProject />', function () {
  let assignStub

  beforeEach(function () {
    assignStub = sinon.stub()
    this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
      assign: assignStub,
      replace: sinon.stub(),
      reload: sinon.stub(),
    })
  })

  afterEach(function () {
    this.locationStub.restore()
    fetchMock.reset()
  })

  it('shows correct modal when clicked', async function () {
    renderWithEditorContext(<ActionsCopyProject />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy Project' }))

    screen.getByPlaceholderText('New Project Name')
  })

  it('loads the project page when submitted', async function () {
    fetchMock.post('express:/project/:id/clone', {
      status: 200,
      body: {
        project_id: 'new-project',
      },
    })

    renderWithEditorContext(<ActionsCopyProject />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy Project' }))

    const input = screen.getByPlaceholderText('New Project Name')
    fireEvent.change(input, { target: { value: 'New Project' } })

    const button = screen.getByRole('button', { name: 'Copy' })
    button.click()

    await waitFor(() => {
      expect(button.textContent).to.equal('Copying…')
    })

    await waitFor(() => {
      expect(assignStub).to.have.been.calledOnceWith('/project/new-project')
    })
  })
})
