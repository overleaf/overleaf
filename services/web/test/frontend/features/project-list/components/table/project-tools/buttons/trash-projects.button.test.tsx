import { fireEvent, screen } from '@testing-library/react'
import TrashProjectsButton from '../../../../../../../../frontend/js/features/project-list/components/table/project-tools/buttons/trash-projects-button'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../../../helpers/render-with-context'

describe('<TrashProjectsButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', async function () {
    renderWithProjectListContext(<TrashProjectsButton />)
    const btn = screen.getByRole('button', { name: 'Trash' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Trash' })
  })

  it('opens the modal when clicked', function () {
    renderWithProjectListContext(<TrashProjectsButton />)
    const btn = screen.getByRole('button', { name: 'Trash' })
    fireEvent.click(btn)
    screen.getByText('Trash Projects')
  })
})
