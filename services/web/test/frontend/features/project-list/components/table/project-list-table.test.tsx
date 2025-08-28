import { screen, within, fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import ProjectListTable from '../../../../../../frontend/js/features/project-list/components/table/project-list-table'
import { currentProjects } from '../../fixtures/projects-data'
import fetchMock from 'fetch-mock'
import { renderWithProjectListContext } from '../../helpers/render-with-context'

const userId = '624333f147cfd8002622a1d3'

describe('<ProjectListTable />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-tags', [])
    window.metaAttributesCache.set('ol-user_id', userId)
    fetchMock.removeRoutes().clearHistory()
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('renders the table', function () {
    renderWithProjectListContext(<ProjectListTable />)
    screen.getByRole('table')
  })

  it('sets aria-sort on column header currently sorted', function () {
    renderWithProjectListContext(<ProjectListTable />)
    let foundSortedColumn = false
    const columns = screen.getAllByRole('columnheader')
    columns.forEach(col => {
      if (col.getAttribute('aria-label') === 'Last modified') {
        expect(col.getAttribute('aria-sort')).to.equal('descending')
        foundSortedColumn = true
      } else {
        expect(col.getAttribute('aria-sort')).to.be.null
      }
    })
    expect(foundSortedColumn).to.be.true
  })

  it('keeps the order type when selecting different column for sorting', function () {
    renderWithProjectListContext(<ProjectListTable />)
    const lastModifiedBtn = screen.getByRole('button', {
      name: /last modified/i,
    })
    const lastModifiedCol = lastModifiedBtn.closest('th')
    expect(lastModifiedCol?.getAttribute('aria-sort')).to.equal('descending')
    const ownerBtn = screen.getByRole('button', { name: /owner/i })
    const ownerCol = ownerBtn.closest('th')
    expect(ownerCol?.getAttribute('aria-sort')).to.be.null
    fireEvent.click(ownerBtn)
    expect(ownerCol?.getAttribute('aria-sort')).to.equal('descending')
    fireEvent.click(ownerBtn)
    expect(ownerCol?.getAttribute('aria-sort')).to.equal('ascending')
  })

  it('renders buttons for sorting all sortable columns', function () {
    renderWithProjectListContext(<ProjectListTable />)
    screen.getByRole('button', { name: 'Sort by Title' })
    screen.getByRole('button', { name: 'Sort by Owner' })
    screen.getByRole('button', { name: 'Reverse Last modified sort order' }) // currently sorted
  })

  it('renders project title, owner, last modified, and action buttons', async function () {
    this.timeout(10000)

    renderWithProjectListContext(<ProjectListTable />)
    await fetchMock.callHistory.flush(true)

    await waitFor(() =>
      expect(screen.getAllByRole('row').length).to.equal(
        currentProjects.length + 1
      )
    )
    const rows = screen.getAllByRole('row')
    rows.shift() // remove first row since it's the header

    // Project name cell
    currentProjects.forEach(project => {
      screen.getByText(project.name)
    })

    // Owner Column and Last Modified Column
    const row1 = screen
      .getByRole('cell', { name: currentProjects[0].name })
      .closest('tr')!
    within(row1).getByText('You')
    within(row1).getAllByText('a day ago by Jean-Luc Picard', { exact: false })
    const row2 = screen
      .getByRole('cell', { name: currentProjects[1].name })
      .closest('tr')!
    within(row2).getByText('Jean-Luc Picard')
    within(row2).getAllByText('7 days ago by Jean-Luc Picard')
    const row3 = screen
      .getByRole('cell', { name: currentProjects[2].name })
      .closest('tr')!
    within(row3).getByText('worf@overleaf.com')
    within(row3).getAllByText('a month ago by worf@overleaf.com')
    // link sharing project
    const row4 = screen
      .getByRole('cell', { name: currentProjects[3].name })
      .closest('tr')!
    within(row4).getByText('La Forge')
    within(row4).getByText('Link sharing')
    within(row4).getAllByText('2 months ago by La Forge')
    // link sharing read only, so it will not show an owner
    const row5 = screen
      .getByRole('cell', { name: currentProjects[4].name })
      .closest('tr')!
    within(row5).getByText('Link sharing')
    within(row5).getAllByText('2 years ago')

    // Action Column
    // temporary count tests until we add filtering for archived/trashed
    const copyButtons = screen.getAllByRole('button', {
      name: 'Copy',
    })
    expect(copyButtons.length).to.equal(currentProjects.length)
    const downloadButtons = screen.getAllByRole('button', {
      name: 'Download .zip file',
    })
    expect(downloadButtons.length).to.equal(currentProjects.length)
    const downloadPDFButtons = screen.getAllByRole('button', {
      name: 'Download PDF',
    })
    expect(downloadPDFButtons.length).to.equal(currentProjects.length)
    const archiveButtons = screen.getAllByRole('button', {
      name: 'Archive',
    })
    expect(archiveButtons.length).to.equal(currentProjects.length)
    const trashButtons = screen.getAllByRole('button', {
      name: 'Trash',
    })
    expect(trashButtons.length).to.equal(currentProjects.length)

    // TODO to be implemented when the component renders trashed & archived projects
    // const restoreButtons = screen.getAllByLabelText('Restore')
    // expect(restoreButtons.length).to.equal(2)
    // const deleteButtons = screen.getAllByLabelText('Delete')
    // expect(deleteButtons.length).to.equal(1)
  })

  it('selects all projects when header checkbox checked', async function () {
    renderWithProjectListContext(<ProjectListTable />)
    await fetchMock.callHistory.flush(true)
    const checkbox = await screen.findByLabelText('Select all projects')

    // Wait for project checkboxes to be visible before clicking the select-all
    // checkbox
    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      expect(allCheckboxes.length).to.equal(currentProjects.length + 1)
    })

    fireEvent.click(checkbox)

    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
      // + 1 because of select all checkbox
      expect(allCheckboxesChecked.length).to.equal(currentProjects.length + 1)
    })
  })

  it('unselects all projects when select all checkbox unchecked', async function () {
    renderWithProjectListContext(<ProjectListTable />)
    await fetchMock.callHistory.flush(true)
    const checkbox = await screen.findByLabelText('Select all projects')

    // Wait for project checkboxes to be visible before clicking the select-all
    // checkbox
    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      expect(allCheckboxes.length).to.equal(currentProjects.length + 1)
    })

    fireEvent.click(checkbox)

    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
      expect(allCheckboxesChecked).to.have.length(currentProjects.length + 1)
    })

    fireEvent.click(checkbox)

    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      expect(allCheckboxes.every(c => !c.checked)).to.be.true
    })
  })

  it('unselects select all projects checkbox when one project is unchecked', async function () {
    renderWithProjectListContext(<ProjectListTable />)
    await fetchMock.callHistory.flush(true)
    const checkbox = await screen.findByLabelText('Select all projects')

    // Wait for project checkboxes to be visible before clicking the select-all
    // checkbox
    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      expect(allCheckboxes.length).to.equal(currentProjects.length + 1)
    })

    fireEvent.click(checkbox)

    // make sure we are unchecking a project checkbox and that it is already
    // checked
    await waitFor(() => {
      expect(
        screen
          .queryAllByRole<HTMLInputElement>('checkbox', { checked: true })?.[1]
          ?.getAttribute('data-project-id')
      ).to.exist
    })

    fireEvent.click(screen.getAllByRole<HTMLInputElement>('checkbox')[1])

    await waitFor(() => {
      const allCheckboxes = screen.queryAllByRole<HTMLInputElement>('checkbox')
      expect(allCheckboxes.length).to.equal(currentProjects.length + 1)
      const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
      expect(allCheckboxesChecked.length).to.equal(currentProjects.length - 1)
    })
  })

  it('only checks the checked project', async function () {
    renderWithProjectListContext(<ProjectListTable />)
    await fetchMock.callHistory.flush(true)
    const checkbox = await screen.findByLabelText(
      `Select ${currentProjects[0].name}`
    )
    fireEvent.click(checkbox)
    const allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
    expect(allCheckboxes.length).to.equal(currentProjects.length + 1)
    const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
    expect(allCheckboxesChecked.length).to.equal(1)
  })
})
