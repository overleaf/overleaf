import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import ProjectListRoot from '../../../../../frontend/js/features/project-list/components/project-list-root'
import { renderWithProjectListContext } from '../helpers/render-with-context'

const userId = '624333f147cfd8002622a1d3'

describe('<ProjectListRoot />', function () {
  const originalLocation = window.location
  const locationStub = sinon.stub()

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-tags', [])
    window.metaAttributesCache.set('ol-ExposedSettings', { templateLinks: [] })
    window.user_id = userId

    Object.defineProperty(window, 'location', {
      value: { assign: locationStub },
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
    let toolbar: HTMLElement
    let project1Id: string | null, project2Id: string | null

    beforeEach(async function () {
      renderWithProjectListContext(<ProjectListRoot />)
      await fetchMock.flush(true)
      await waitFor(() => {
        screen.findByRole('table')
      })
    })

    describe('all projects', function () {
      beforeEach(function () {
        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[1])
        fireEvent.click(allCheckboxes[2])

        project1Id = allCheckboxes[1].getAttribute('data-project-id')
        project2Id = allCheckboxes[2].getAttribute('data-project-id')
        toolbar = screen.getByRole('toolbar')
      })

      it('downloads all selected projects and then unselects them', async function () {
        const downloadButton = within(toolbar).getByLabelText('Download')
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

        const archiveButton = within(toolbar).getByLabelText('Archive')
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

        const archiveButton = within(toolbar).getByLabelText('Trash')
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
    })

    describe('archived projects', function () {
      beforeEach(function () {
        const filterButton = screen.getByText('Archived Projects')
        fireEvent.click(filterButton)

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        expect(allCheckboxes.length === 2).to.be.true
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[1])
        project1Id = allCheckboxes[1].getAttribute('data-project-id')
      })
      it('does not show the archive button in toolbar when archive view selected', function () {
        expect(screen.queryByLabelText('Archive')).to.be.null
      })
    })

    describe('trashed projects', function () {
      beforeEach(function () {
        const filterButton = screen.getByText('Trashed Projects')
        fireEvent.click(filterButton)

        allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        // first one is the select all checkbox
        fireEvent.click(allCheckboxes[1])

        project1Id = allCheckboxes[1].getAttribute('data-project-id')
      })
      it('does not show the trash button in toolbar when archive view selected', function () {
        expect(screen.queryByLabelText('Trash')).to.be.null
      })

      it('clears selected projects when filter changed', function () {
        const filterButton = screen.getByText('All Projects')
        fireEvent.click(filterButton)

        const allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
        const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
        expect(allCheckboxesChecked.length).to.equal(0)
      })
    })
  })
})
