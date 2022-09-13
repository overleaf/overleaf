import { render, screen, within, fireEvent } from '@testing-library/react'
import { expect } from 'chai'
import ProjectListTable from '../../../../../../frontend/js/features/project-list/components/table/project-list-table'
import { ProjectListProvider } from '../../../../../../frontend/js/features/project-list/context/project-list-context'
import { projectsData } from '../../fixtures/projects-data'
import fetchMock from 'fetch-mock'

const userId = '624333f147cfd8002622a1d3'

const renderProjectListTableWithinProjectListProvider = () => {
  render(<ProjectListTable />, {
    wrapper: ({ children }) => (
      <ProjectListProvider>{children}</ProjectListProvider>
    ),
  })
}

describe('<ProjectListTable />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-tags', [])
    window.user_id = userId
    fetchMock.reset()
  })

  afterEach(function () {
    window.user_id = undefined
    fetchMock.reset()
  })

  it('renders the table', function () {
    renderProjectListTableWithinProjectListProvider()
    screen.getByRole('table')
  })

  it('sets aria-sort on column header currently sorted', function () {
    renderProjectListTableWithinProjectListProvider()
    let foundSortedColumn = false
    const columns = screen.getAllByRole('columnheader')
    columns.forEach(col => {
      if (col.getAttribute('aria-label') === 'Last Modified') {
        expect(col.getAttribute('aria-sort')).to.equal('Descending')
        foundSortedColumn = true
      } else {
        expect(col.getAttribute('aria-sort')).to.be.null
      }
    })
    expect(foundSortedColumn).to.be.true
  })

  it('keeps the order type when selecting different column for sorting', function () {
    renderProjectListTableWithinProjectListProvider()
    const lastModifiedBtn = screen.getByRole('button', {
      name: /last modified/i,
    })
    const lastModifiedCol = lastModifiedBtn.closest('th')
    expect(lastModifiedCol?.getAttribute('aria-sort')).to.equal('Descending')
    const ownerBtn = screen.getByRole('button', { name: /owner/i })
    const ownerCol = ownerBtn.closest('th')
    expect(ownerCol?.getAttribute('aria-sort')).to.be.null
    fireEvent.click(ownerBtn)
    expect(ownerCol?.getAttribute('aria-sort')).to.equal('Descending')
    fireEvent.click(ownerBtn)
    expect(ownerCol?.getAttribute('aria-sort')).to.equal('Ascending')
  })

  it('renders buttons for sorting all sortable columns', function () {
    renderProjectListTableWithinProjectListProvider()
    screen.getByText('Sort by Title')
    screen.getByText('Sort by Owner')
    screen.getByText('Reverse Last Modified sort order') // currently sorted
  })

  it('renders project title, owner, last modified, and action buttons', async function () {
    // archived and trashed projects are currently not shown
    const filteredProjects = projectsData.filter(
      ({ archived, trashed }) => !archived && !trashed
    )

    fetchMock.post('/api/project', {
      status: 200,
      body: {
        projects: filteredProjects,
        totalSize: filteredProjects.length,
      },
    })

    renderProjectListTableWithinProjectListProvider()
    await fetchMock.flush(true)

    const rows = screen.getAllByRole('row')
    rows.shift() // remove first row since it's the header
    expect(rows.length).to.equal(filteredProjects.length)

    // Project name cell
    filteredProjects.forEach(project => {
      screen.getByText(project.name)
    })

    // Owner Column and Last Modified Column
    const row1 = screen
      .getByRole('cell', { name: filteredProjects[0].name })
      .closest('tr')!
    within(row1).getByText('You')
    within(row1).getByText('a day ago by Jean-Luc Picard')
    const row2 = screen
      .getByRole('cell', { name: filteredProjects[1].name })
      .closest('tr')!
    within(row2).getByText('Jean-Luc Picard')
    within(row2).getByText('7 days ago by Jean-Luc Picard')
    const row3 = screen
      .getByRole('cell', { name: filteredProjects[2].name })
      .closest('tr')!
    within(row3).getByText('worf@overleaf.com')
    within(row3).getByText('a month ago by worf@overleaf.com')
    // link sharing project
    const row4 = screen
      .getByRole('cell', { name: filteredProjects[3].name })
      .closest('tr')!
    within(row4).getByText('La Forge')
    within(row4).getByText('Link sharing')
    within(row4).getByText('2 months ago by La Forge')
    // link sharing read only, so it will not show an owner
    const row5 = screen
      .getByRole('cell', { name: filteredProjects[4].name })
      .closest('tr')!
    within(row5).getByText('Link sharing')
    within(row5).getByText('2 years ago')

    // Action Column
    // temporary count tests until we add filtering for archived/trashed
    const copyButtons = screen.getAllByLabelText('Copy')
    screen.debug()
    expect(copyButtons.length).to.equal(filteredProjects.length)
    const downloadButtons = screen.getAllByLabelText('Download')
    expect(downloadButtons.length).to.equal(filteredProjects.length)
    const archiveButtons = screen.getAllByLabelText('Archive')
    expect(archiveButtons.length).to.equal(filteredProjects.length)
    const trashButtons = screen.getAllByLabelText('Trash')
    expect(trashButtons.length).to.equal(filteredProjects.length)

    // TODO to be implemented when the component renders trashed & archived projects
    // const restoreButtons = screen.getAllByLabelText('Restore')
    // expect(restoreButtons.length).to.equal(2)
    // const deleteButtons = screen.getAllByLabelText('Delete')
    // expect(deleteButtons.length).to.equal(1)
  })
})
