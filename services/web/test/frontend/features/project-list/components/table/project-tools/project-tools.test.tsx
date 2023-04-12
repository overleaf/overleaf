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

  it('renders the project tools for the all projects filter', function () {
    renderWithProjectListContext(<ProjectTools />)
    expect(screen.getAllByRole('button').length).to.equal(5)
    screen.getByLabelText('Download')
    screen.getByLabelText('Archive')
    screen.getByLabelText('Trash')
    screen.getByTitle('Tags')
    screen.getByRole('button', { name: 'Create new tag' })
  })
})
