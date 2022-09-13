import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import CopyProjectButton from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/copy-project-button'
import {
  archivedProject,
  copyableProject,
  trashedProject,
} from '../../../../fixtures/projects-data'

describe('<CopyProjectButton />', function () {
  it('renders tooltip for button', function () {
    render(<CopyProjectButton project={copyableProject} />)
    const btn = screen.getByLabelText('Copy')
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Copy' })
  })

  it('does not render the button when project is archived', function () {
    render(<CopyProjectButton project={archivedProject} />)
    expect(screen.queryByLabelText('Copy')).to.be.null
  })

  it('does not render the button when project is trashed', function () {
    render(<CopyProjectButton project={trashedProject} />)
    expect(screen.queryByLabelText('Copy')).to.be.null
  })
})
