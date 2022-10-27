import { fireEvent, screen } from '@testing-library/dom'
import fetchMock from 'fetch-mock'
import ActionsCopyProject from '../../../../../frontend/js/features/editor-left-menu/components/actions-copy-project'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<ActionsCopyProject />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct modal when clicked', async function () {
    renderWithEditorContext(<ActionsCopyProject />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy Project' }))

    screen.getByPlaceholderText('New Project Name')
  })
})
