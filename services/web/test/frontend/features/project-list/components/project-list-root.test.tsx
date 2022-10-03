import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import ProjectListRoot from '../../../../../frontend/js/features/project-list/components/project-list-root'
import { renderWithProjectListContext } from '../helpers/render-with-context'
import {
  owner,
  archivedProjects,
  makeLongProjectList,
} from '../fixtures/projects-data'
const { fullList, currentList, trashedList } = makeLongProjectList(40)

const userId = owner.id

describe('<ProjectListRoot />', function () {
  const originalLocation = window.location
  const locationStub = sinon.stub()

  beforeEach(async function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-tags', [])
    window.metaAttributesCache.set('ol-ExposedSettings', { templateLinks: [] })
    window.user_id = userId

    Object.defineProperty(window, 'location', {
      value: { assign: locationStub },
    })

    renderWithProjectListContext(<ProjectListRoot />, {
      projects: fullList,
    })
    await fetchMock.flush(true)
    await waitFor(() => {
      screen.findByRole('table')
    })
  })

  afterEach(function () {
    window.user_id = undefined
    fetchMock.reset()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    })
  })

  describe('checkboxes', function () {
    let allCheckboxes: Array<HTMLInputElement> = []
    let actionsToolbar: HTMLElement
    let project1Id: string | null, project2Id: string | null

    describe('all projects', function () {
      beforeEach(function () {
        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[1])
        fireEvent.click(allCheckboxes[2])

        project1Id = allCheckboxes[1].getAttribute('data-project-id')
        project2Id = allCheckboxes[2].getAttribute('data-project-id')
        actionsToolbar = screen.getAllByRole('toolbar')[0]
      })

      it('downloads all selected projects and then unselects them', async function () {
        const downloadButton = within(actionsToolbar).getByLabelText('Download')
        fireEvent.click(downloadButton)

        await waitFor(() => {
          expect(locationStub).to.have.been.called
        })

        sinon.assert.calledWithMatch(
          locationStub,
          `/project/download/zip?project_ids=${project1Id},${project2Id}`
        )

        const allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
        expect(allCheckboxesChecked.length).to.equal(0)
      })

      it('opens archive modal for all selected projects and archives all', async function () {
        fetchMock.post(
          `express:/project/${project1Id}/archive`,
          {
            status: 200,
          },
          { delay: 0 }
        )
        fetchMock.post(
          `express:/project/${project2Id}/archive`,
          {
            status: 200,
          },
          { delay: 0 }
        )

        const archiveButton = within(actionsToolbar).getByLabelText('Archive')
        fireEvent.click(archiveButton)

        const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
        fireEvent.click(confirmBtn)
        expect(confirmBtn.disabled).to.be.true

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        const requests = fetchMock.calls()
        const [projectRequest1Url, projectRequest1Headers] = requests[2]
        expect(projectRequest1Url).to.equal(`/project/${project1Id}/archive`)
        expect(projectRequest1Headers?.method).to.equal('POST')
        const [projectRequest2Url, projectRequest2Headers] = requests[3]
        expect(projectRequest2Url).to.equal(`/project/${project2Id}/archive`)
        expect(projectRequest2Headers?.method).to.equal('POST')
      })

      it('opens trash modal for all selected projects and trashes all', async function () {
        fetchMock.post(
          `express:/project/${project1Id}/trash`,
          {
            status: 200,
          },
          { delay: 0 }
        )
        fetchMock.post(
          `express:/project/${project2Id}/trash`,
          {
            status: 200,
          },
          { delay: 0 }
        )

        const archiveButton = within(actionsToolbar).getByLabelText('Trash')
        fireEvent.click(archiveButton)

        const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
        fireEvent.click(confirmBtn)
        expect(confirmBtn.disabled).to.be.true

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        const requests = fetchMock.calls()
        const [projectRequest1Url, projectRequest1Headers] = requests[2]
        expect(projectRequest1Url).to.equal(`/project/${project1Id}/trash`)
        expect(projectRequest1Headers?.method).to.equal('POST')
        const [projectRequest2Url, projectRequest2Headers] = requests[3]
        expect(projectRequest2Url).to.equal(`/project/${project2Id}/trash`)
        expect(projectRequest2Headers?.method).to.equal('POST')
      })

      it('only checks the projects that are viewable when there is a load more button', async function () {
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[0])

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        let checked = allCheckboxes.filter(c => c.checked)
        expect(checked.length).to.equal(21) // max projects viewable by default is 20, and plus one for check all

        const loadMoreButton = screen.getByLabelText('Show 17 more projects')
        fireEvent.click(loadMoreButton)

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        expect(allCheckboxes.length).to.equal(currentList.length + 1)
        checked = allCheckboxes.filter(c => c.checked)
        expect(checked.length).to.equal(20) // remains same even after showing more
      })

      it('maintains viewable and selected projects after loading more and then selecting all', async function () {
        const loadMoreButton = screen.getByLabelText('Show 17 more projects')
        fireEvent.click(loadMoreButton)
        // verify button gone
        screen.getByText(
          `Showing ${currentList.length} out of ${currentList.length} projects.`
        )
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[0])
        // verify button still gone
        screen.getByText(
          `Showing ${currentList.length} out of ${currentList.length} projects.`
        )

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        expect(allCheckboxes.length).to.equal(currentList.length + 1)
      })
    })

    describe('archived projects', function () {
      beforeEach(function () {
        const filterButton = screen.getAllByText('Archived Projects')[0]
        fireEvent.click(filterButton)

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        expect(allCheckboxes.length === 2).to.be.true
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[1])
        project1Id = allCheckboxes[1].getAttribute('data-project-id')

        actionsToolbar = screen.getAllByRole('toolbar')[0]
      })

      it('does not show the archive button in toolbar when archive view selected', function () {
        expect(screen.queryByLabelText('Archive')).to.be.null
      })

      it('restores all projects when selected', async function () {
        fetchMock.delete(`express:/project/:id/archive`, {
          status: 200,
        })

        const unarchiveButton =
          within(actionsToolbar).getByText<HTMLInputElement>('Restore')
        fireEvent.click(unarchiveButton)

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        screen.getByText('No projects')
      })

      it('only unarchive the selected projects', async function () {
        // beforeEach selected all, so uncheck the 1st project
        fireEvent.click(allCheckboxes[1])

        const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
        expect(allCheckboxesChecked.length).to.equal(
          archivedProjects.length - 1
        )

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        expect(screen.queryByText('No projects')).to.be.null
      })
    })

    describe('trashed projects', function () {
      beforeEach(function () {
        const filterButton = screen.getAllByText('Trashed Projects')[0]
        fireEvent.click(filterButton)

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        // + 1 because of select all
        expect(allCheckboxes.length).to.equal(trashedList.length + 1)

        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[0])

        const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
        // + 1 because of select all
        expect(allCheckboxesChecked.length).to.equal(trashedList.length + 1)

        actionsToolbar = screen.getAllByRole('toolbar')[0]
      })

      it('only shows the download, archive, and restore buttons in top toolbar', function () {
        expect(screen.queryByLabelText('Trash')).to.be.null
        within(actionsToolbar).queryByLabelText('Download')
        within(actionsToolbar).queryByLabelText('Archive')
        within(actionsToolbar).getByText('Restore') // no icon for this button
      })

      it('clears selected projects when filter changed', function () {
        const filterButton = screen.getAllByText('All Projects')[0]
        fireEvent.click(filterButton)

        const allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
        expect(allCheckboxesChecked.length).to.equal(0)
      })

      it('untrashes all the projects', async function () {
        fetchMock.delete(`express:/project/:id/trash`, {
          status: 200,
        })

        const untrashButton =
          within(actionsToolbar).getByText<HTMLInputElement>('Restore')
        fireEvent.click(untrashButton)

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        screen.getByText('No projects')
      })

      it('only untrashes the selected projects', async function () {
        // beforeEach selected all, so uncheck the 1st project
        fireEvent.click(allCheckboxes[1])

        const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
        expect(allCheckboxesChecked.length).to.equal(trashedList.length - 1)

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        expect(screen.queryByText('No projects')).to.be.null
      })

      it('removes project from view when archiving', async function () {
        fetchMock.post(`express:/project/:id/archive`, {
          status: 200,
        })

        const untrashButton =
          within(actionsToolbar).getByLabelText<HTMLInputElement>('Archive')
        fireEvent.click(untrashButton)

        const confirmButton = screen.getByText<HTMLInputElement>('Confirm')
        fireEvent.click(confirmButton)
        expect(confirmButton.disabled).to.be.true

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        screen.getByText('No projects')
      })
    })
  })

  describe('search', function () {
    it('shows only projects based on the input', async function () {
      await fetchMock.flush(true)
      await waitFor(() => {
        screen.findByRole('table')
      })

      const input = screen.getAllByRole('textbox', {
        name: /search projects/i,
      })[0]
      const value = currentList[0].name

      fireEvent.change(input, { target: { value } })

      const results = screen.getAllByRole('row')
      expect(results.length).to.equal(2) // first is header
    })
  })

  describe('copying project', function () {
    it('correctly updates the view after copying a shared project', async function () {
      const filterButton = screen.getAllByText('Shared with you')[0]
      fireEvent.click(filterButton)

      const tableRows = screen.getAllByRole('row')

      const linkForProjectToCopy = within(tableRows[1]).getByRole('link')
      const projectNameToCopy = linkForProjectToCopy.textContent
      const copiedProjectName = `${projectNameToCopy} Copy`
      fetchMock.post(`express:/project/:id/clone`, {
        status: 200,
        body: {
          name: copiedProjectName,
          lastUpdated: new Date(),
          project_id: userId,
          owner_ref: userId,
          owner,
          id: '6328e14abec0df019fce0be5',
          lastUpdatedBy: owner,
          accessLevel: 'owner',
          source: 'owner',
          trashed: false,
          archived: false,
        },
      })
      const copyButton = within(tableRows[1]).getAllByLabelText('Copy')[0]
      fireEvent.click(copyButton)

      // confirm in modal
      // const copyConfirmButton = screen.getByText('Copy')
      const copyConfirmButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLElement
      fireEvent.click(copyConfirmButton)

      await fetchMock.flush(true)
      expect(fetchMock.done()).to.be.true

      expect(screen.queryByText(copiedProjectName)).to.be.null

      const yourProjectFilter = screen.getAllByText('Your Projects')[0]
      fireEvent.click(yourProjectFilter)
      screen.findByText(copiedProjectName)
    })
  })
})
