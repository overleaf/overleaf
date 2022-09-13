import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import DeleteProjectButton from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/delete-project-button'
import {
  archiveableProject,
  trashedAndNotOwnedProject,
  trashedProject,
} from '../../../../fixtures/projects-data'

describe('<DeleteProjectButton />', function () {
  it('renders tooltip for button', function () {
    window.user_id = trashedProject?.owner?.id
    render(<DeleteProjectButton project={trashedProject} />)
    const btn = screen.getByLabelText('Delete')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Delete' })
  })

  it('does not render button when trashed and not owner', function () {
    window.user_id = '123abc'
    render(<DeleteProjectButton project={trashedAndNotOwnedProject} />)
    const btn = screen.queryByLabelText('Delete')
    expect(btn).to.be.null
  })

  it('does not render the button when project is current', function () {
    render(<DeleteProjectButton project={archiveableProject} />)
    expect(screen.queryByLabelText('Delete')).to.be.null
  })
})
