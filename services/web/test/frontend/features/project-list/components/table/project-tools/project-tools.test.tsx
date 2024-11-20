import { screen } from '@testing-library/react'
import { expect } from 'chai'
import ProjectTools from '../../../../../../../frontend/js/features/project-list/components/table/project-tools/project-tools'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../../helpers/render-with-context'

describe('<ProjectTools />', function () {
  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders the project tools for the all projects filter', async function () {
    renderWithProjectListContext(<ProjectTools />)

    const initialButtons = screen.getAllByRole('button')
    expect(initialButtons).to.have.length(4)

    expect(screen.getByLabelText('Download')).to.exist
    expect(screen.getByLabelText('Archive')).to.exist
    expect(screen.getByLabelText('Trash')).to.exist
    expect(screen.getByLabelText('Tags')).to.exist

    expect(screen.queryByText('Create new tag')).to.not.exist

    screen.getByLabelText('Tags').click()

    const createTagButton = await screen.findByText('Create new tag')
    expect(createTagButton).to.exist
  })
})
