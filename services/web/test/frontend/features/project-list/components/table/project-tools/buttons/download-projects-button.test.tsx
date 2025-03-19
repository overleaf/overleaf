import { fireEvent, screen } from '@testing-library/react'
import DownloadProjectsButton from '../../../../../../../../frontend/js/features/project-list/components/table/project-tools/buttons/download-projects-button'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../../../helpers/render-with-context'

describe('<DownloadProjectsButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', async function () {
    renderWithProjectListContext(<DownloadProjectsButton />)
    const btn = screen.getByRole('button', { name: 'Download' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Download' })
  })
})
