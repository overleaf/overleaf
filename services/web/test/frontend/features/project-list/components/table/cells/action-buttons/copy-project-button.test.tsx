import { expect } from 'chai'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { CopyProjectButtonTooltip } from '../../../../../../../../frontend/js/features/project-list/components/table/cells/action-buttons/copy-project-button'
import {
  archivedProject,
  copyableProject,
  trashedProject,
} from '../../../../fixtures/projects-data'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../../helpers/render-with-context'
import fetchMock from 'fetch-mock'

describe('<CopyProjectButton />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tooltip for button', async function () {
    renderWithProjectListContext(
      <CopyProjectButtonTooltip project={copyableProject} />
    )
    const btn = screen.getByRole('button', { name: 'Copy' })
    fireEvent.mouseOver(btn)
    await screen.findByRole('tooltip', { name: 'Copy' })
  })

  it('does not render the button when project is archived', function () {
    renderWithProjectListContext(
      <CopyProjectButtonTooltip project={archivedProject} />
    )
    expect(screen.queryByRole('button', { name: 'Copy' })).to.be.null
  })

  it('does not render the button when project is trashed', function () {
    renderWithProjectListContext(
      <CopyProjectButtonTooltip project={trashedProject} />
    )
    expect(screen.queryByRole('button', { name: 'Copy' })).to.be.null
  })

  it('opens the modal and copies the project', async function () {
    const copyProjectMock = fetchMock.post(
      `express:/project/:projectId/clone`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    renderWithProjectListContext(
      <CopyProjectButtonTooltip project={copyableProject} />
    )

    const btn = screen.getByRole('button', { name: 'Copy' })

    fireEvent.click(btn)
    screen.getByText('Copy project')
    screen.getByLabelText(/New name/i)
    screen.getByDisplayValue(`${copyableProject.name} (Copy)`)
    const copyBtn = screen.getAllByRole<HTMLButtonElement>('button', {
      name: 'Copy',
    })[1]
    fireEvent.click(copyBtn)
    expect(copyBtn.disabled).to.be.true

    await waitFor(
      () =>
        expect(
          copyProjectMock.callHistory.called(
            `/project/${copyableProject.id}/clone`
          )
        ).to.be.true
    )
  })
})
