import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import ProjectListRoot from '../../../../../frontend/js/features/project-list/components/project-list-root'
import { renderWithProjectListContext } from '../helpers/render-with-context'
import * as eventTracking from '@/infrastructure/event-tracking'
import {
  projectsData,
  owner,
  archivedProjects,
  makeLongProjectList,
  archiveableProject,
  copyableProject,
} from '../fixtures/projects-data'
import * as useLocationModule from '../../../../../frontend/js/shared/hooks/use-location'
import getMeta from '@/utils/meta'

const {
  fullList,
  currentList,
  archivedList,
  trashedList,
  leavableList,
  deletableList,
} = makeLongProjectList(40)

const userId = owner.id

describe('<ProjectListRoot />', function () {
  this.timeout('10s')

  let sendMBSpy: sinon.SinonSpy
  let assignStub: sinon.SinonStub

  beforeEach(async function () {
    global.localStorage.clear()
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
    this.tagId = '999fff999fff'
    this.tagName = 'First tag name'
    window.metaAttributesCache.set('ol-tags', [
      {
        _id: this.tagId,
        name: this.tagName,
        project_ids: [projectsData[0].id, projectsData[1].id],
      },
    ])
    Object.assign(getMeta('ol-ExposedSettings'), {
      templateLinks: [],
    })
    window.metaAttributesCache.set('ol-userEmails', [
      { email: 'test@overleaf.com', default: true },
    ])
    // we need a blank user here since its used in checking if we should display certain ads
    window.metaAttributesCache.set('ol-user', {})
    window.metaAttributesCache.set('ol-user_id', userId)
    window.metaAttributesCache.set('ol-footer', {
      showThinFooter: false,
      translatedLanguages: { en: 'English' },
      subdomainLang: { en: { lngCode: 'en', url: 'overleaf.com' } },
    })
    window.metaAttributesCache.set('ol-navbar', {
      items: [],
    })
    assignStub = sinon.stub()
    this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
      assign: assignStub,
      replace: sinon.stub(),
      reload: sinon.stub(),
      setHash: sinon.stub(),
    })
  })

  afterEach(function () {
    sendMBSpy.restore()
    fetchMock.reset()
    this.locationStub.restore()
  })

  describe('welcome page', function () {
    beforeEach(async function () {
      renderWithProjectListContext(<ProjectListRoot />, {
        projects: [],
      })
      await fetchMock.flush(true)
    })

    it('the welcome page is displayed', async function () {
      screen.getByRole('heading', { name: 'Welcome to Overleaf' })
    })

    it('the email confirmation alert is not displayed', async function () {
      expect(
        screen.queryByText(
          'Please confirm your email test@overleaf.com by clicking on the link in the confirmation email'
        )
      ).to.be.null
    })
  })

  describe('project table', function () {
    beforeEach(async function () {
      const { unmount } = renderWithProjectListContext(<ProjectListRoot />, {
        projects: fullList,
      })
      this.unmount = unmount
      await fetchMock.flush(true)
      await screen.findByRole('table')
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
          const downloadButton =
            within(actionsToolbar).getByLabelText('Download')
          fireEvent.click(downloadButton)

          await waitFor(() => {
            expect(assignStub).to.have.been.called
          })

          sinon.assert.calledWithMatch(
            assignStub,
            `/project/download/zip?project_ids=${project1Id},${project2Id}`
          )

          const allCheckboxes =
            screen.getAllByRole<HTMLInputElement>('checkbox')
          const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
          expect(allCheckboxesChecked.length).to.equal(0)
        })

        it('opens archive modal for all selected projects and archives all', async function () {
          const archiveProjectMock = fetchMock.post(
            `express:/project/:projectId/archive`,
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

          await waitFor(
            () =>
              expect(
                archiveProjectMock.called(`/project/${project1Id}/archive`)
              ).to.be.true
          )
          await waitFor(
            () =>
              expect(
                archiveProjectMock.called(`/project/${project2Id}/archive`)
              ).to.be.true
          )
        })

        it('opens trash modal for all selected projects and trashes all', async function () {
          const trashProjectMock = fetchMock.post(
            `express:/project/:projectId/trash`,
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

          await waitFor(
            () =>
              expect(trashProjectMock.called(`/project/${project1Id}/trash`)).to
                .be.true
          )
          await waitFor(
            () =>
              expect(trashProjectMock.called(`/project/${project2Id}/trash`)).to
                .be.true
          )
        })

        it('only checks the projects that are viewable when there is a load more button', async function () {
          // first one is the select all checkbox
          fireEvent.click(allCheckboxes[0])

          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          let checked = allCheckboxes.filter(c => c.checked)
          expect(checked.length).to.equal(21) // max projects viewable by default is 20, and plus one for check all

          const loadMoreButton = screen.getByRole('button', {
            name: 'Show 17 more projects',
          })
          fireEvent.click(loadMoreButton)

          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          expect(allCheckboxes.length).to.equal(currentList.length + 1)
          checked = allCheckboxes.filter(c => c.checked)
          expect(checked.length).to.equal(20) // remains same even after showing more
        })

        it('maintains viewable and selected projects after loading more and then selecting all', async function () {
          const loadMoreButton = screen.getByRole('button', {
            name: 'Show 17 more projects',
          })
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

          // allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // expect(allCheckboxes.length).to.equal(currentList.length + 1)
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
            within(actionsToolbar).getByText<HTMLButtonElement>('Restore')
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

        it('shows the download, archive, and restore buttons in top toolbar', function () {
          expect(screen.queryByLabelText('Trash')).to.be.null
          within(actionsToolbar).queryByLabelText('Download')
          within(actionsToolbar).queryByLabelText('Archive')
          within(actionsToolbar).getByText('Restore') // no icon for this button
        })

        it('clears selected projects when filter changed', function () {
          const filterButton = screen.getAllByText('All Projects')[0]
          fireEvent.click(filterButton)

          const allCheckboxes =
            screen.getAllByRole<HTMLInputElement>('checkbox')
          const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
          expect(allCheckboxesChecked.length).to.equal(0)
        })

        it('untrashes all the projects', async function () {
          fetchMock.delete(`express:/project/:id/trash`, {
            status: 200,
          })

          const untrashButton =
            within(actionsToolbar).getByText<HTMLButtonElement>('Restore')
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
          fetchMock.post(
            `express:/project/:id/archive`,
            {
              status: 200,
            },
            { repeat: trashedList.length }
          )

          const archiveButton =
            within(actionsToolbar).getByLabelText<HTMLButtonElement>('Archive')
          fireEvent.click(archiveButton)

          const confirmButton = screen.getByText<HTMLButtonElement>('Confirm')
          fireEvent.click(confirmButton)
          expect(confirmButton.disabled).to.be.true

          await fetchMock.flush(true)
          expect(fetchMock.done()).to.be.true

          const calls = fetchMock.calls().map(([url]) => url)

          trashedList.forEach(project => {
            expect(calls).to.contain(`/project/${project.id}/archive`)
          })
        })

        it('removes only selected projects from view when leaving', async function () {
          // rerender content with different projects
          this.unmount()
          fetchMock.restore()

          renderWithProjectListContext(<ProjectListRoot />, {
            projects: leavableList,
          })

          await fetchMock.flush(true)
          await screen.findByRole('table')

          expect(leavableList.length).to.be.greaterThan(0)

          fetchMock.post(
            `express:/project/:id/leave`,
            {
              status: 200,
            },
            { repeat: leavableList.length }
          )

          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // + 1 because of select all
          expect(allCheckboxes.length).to.equal(leavableList.length + 1)

          // first one is the select all checkbox
          fireEvent.click(allCheckboxes[0])

          actionsToolbar = screen.getAllByRole('toolbar')[0]

          const toolbar = within(actionsToolbar)
          expect(toolbar.queryByRole('button', { name: /delete/i })).to.be.null
          expect(
            toolbar.queryByRole('button', {
              name: /delete \/ leave/i,
            })
          ).to.be.null

          const leaveButton = toolbar.getByRole('button', {
            name: /leave/i,
          })
          fireEvent.click(leaveButton)

          const confirmButton = screen.getByText<HTMLButtonElement>('Confirm')
          fireEvent.click(confirmButton)
          expect(confirmButton.disabled).to.be.true

          await fetchMock.flush(true)
          expect(fetchMock.done()).to.be.true

          const calls = fetchMock.calls().map(([url]) => url)
          leavableList.forEach(project => {
            expect(calls).to.contain(`/project/${project.id}/leave`)
          })
        })

        it('removes only selected projects from view when deleting', async function () {
          // rerender content with different projects
          this.unmount()
          fetchMock.restore()

          renderWithProjectListContext(<ProjectListRoot />, {
            projects: deletableList,
          })

          await fetchMock.flush(true)
          await screen.findByRole('table')

          expect(deletableList.length).to.be.greaterThan(0)

          fetchMock.delete(
            `express:/project/:id`,
            {
              status: 200,
            },
            { repeat: deletableList.length }
          )

          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // + 1 because of select all
          expect(allCheckboxes.length).to.equal(deletableList.length + 1)

          // first one is the select all checkbox
          fireEvent.click(allCheckboxes[0])

          actionsToolbar = screen.getAllByRole('toolbar')[0]

          const toolbar = within(actionsToolbar)
          expect(toolbar.queryByRole('button', { name: /leave/i })).to.be.null
          expect(
            toolbar.queryByRole('button', {
              name: /delete \/ leave/i,
            })
          ).to.be.null

          const deleteButton = toolbar.getByRole('button', {
            name: /delete/i,
          })
          fireEvent.click(deleteButton)

          const confirmButton = screen.getByText<HTMLButtonElement>('Confirm')
          fireEvent.click(confirmButton)
          expect(confirmButton.disabled).to.be.true

          await fetchMock.flush(true)
          expect(fetchMock.done()).to.be.true

          const calls = fetchMock.calls().map(([url]) => url)
          deletableList.forEach(project => {
            expect(calls).to.contain(`/project/${project.id}`)
          })
        })

        it('removes only selected projects from view when deleting and leaving', async function () {
          // rerender content with different projects
          this.unmount()
          fetchMock.restore()

          const deletableAndLeavableList = [...deletableList, ...leavableList]

          renderWithProjectListContext(<ProjectListRoot />, {
            projects: deletableAndLeavableList,
          })

          await fetchMock.flush(true)
          await screen.findByRole('table')

          expect(deletableList.length).to.be.greaterThan(0)
          expect(leavableList.length).to.be.greaterThan(0)

          fetchMock
            .delete(
              `express:/project/:id`,
              {
                status: 200,
              },
              { repeat: deletableList.length }
            )
            .post(
              `express:/project/:id/leave`,
              {
                status: 200,
              },
              { repeat: leavableList.length }
            )

          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // + 1 because of select all
          expect(allCheckboxes.length).to.equal(
            deletableAndLeavableList.length + 1
          )

          // first one is the select all checkbox
          fireEvent.click(allCheckboxes[0])

          actionsToolbar = screen.getAllByRole('toolbar')[0]

          const toolbar = within(actionsToolbar)
          expect(toolbar.queryByRole('button', { name: 'Leave' })).to.be.null
          expect(toolbar.queryByRole('button', { name: 'Delete' })).to.be.null

          const deleteLeaveButton = toolbar.getByRole('button', {
            name: /delete \/ leave/i,
          })
          fireEvent.click(deleteLeaveButton)

          const confirmButton = screen.getByText<HTMLButtonElement>('Confirm')
          fireEvent.click(confirmButton)
          expect(confirmButton.disabled).to.be.true

          await fetchMock.flush(true)
          expect(fetchMock.done()).to.be.true

          const calls = fetchMock.calls().map(([url]) => url)
          deletableAndLeavableList.forEach(project => {
            expect(calls).to.contain.oneOf([
              `/project/${project.id}`,
              `/project/${project.id}/leave`,
            ])
          })
        })
      })

      describe('tags', function () {
        it('does not show archived or trashed project', async function () {
          this.unmount()
          fetchMock.restore()
          window.metaAttributesCache.set('ol-tags', [
            {
              _id: this.tagId,
              name: this.tagName,
              project_ids: [
                projectsData[0].id,
                projectsData[1].id,
                ...archivedList.map(p => p.id),
                ...trashedList.map(p => p.id),
              ],
            },
          ])

          const trashProjectMock = fetchMock.post(
            `express:/project/:projectId/trash`,
            { status: 200 }
          )

          renderWithProjectListContext(<ProjectListRoot />, {
            projects: fullList,
          })

          await screen.findByRole('table')

          let visibleProjectsCount = 2
          const [tagBtn] = screen.getAllByRole('button', {
            name: `${this.tagName} (${visibleProjectsCount})`,
          })
          fireEvent.click(tagBtn)

          const nonArchivedAndTrashedProjects = [
            projectsData[0],
            projectsData[1],
          ]
          nonArchivedAndTrashedProjects.forEach(p => {
            screen.getByText(p.name)
          })
          const archivedAndTrashedProjects = [...archivedList, ...trashedList]
          archivedAndTrashedProjects.forEach(p => {
            expect(screen.queryByText(p.name)).to.be.null
          })

          const trashBtns = screen.getAllByRole('button', { name: 'Trash' })
          for (const [index, trashBtn] of trashBtns.entries()) {
            fireEvent.click(trashBtn)
            fireEvent.click(screen.getByText<HTMLButtonElement>('Confirm'))
            await waitFor(() => {
              expect(
                trashProjectMock.called(
                  `/project/${projectsData[index].id}/trash`
                )
              ).to.be.true
            })
            expect(
              screen.queryAllByText(projectsData[index].name)
            ).to.have.length(0)

            screen.getAllByRole('button', {
              name: `${this.tagName} (${--visibleProjectsCount})`,
            })
          }
        })
      })

      describe('tags dropdown', function () {
        beforeEach(async function () {
          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // first one is the select all checkbox
          fireEvent.click(allCheckboxes[1])
          fireEvent.click(allCheckboxes[2])
          actionsToolbar = screen.getAllByRole('toolbar')[0]

          this.newTagName = 'Some tag name'
          this.newTagId = 'abc123def456'
        })

        it('opens the tags dropdown and creates a new tag', async function () {
          fetchMock.post(`express:/tag`, {
            status: 200,
            body: {
              _id: this.newTagId,
              name: this.newTagName,
              project_ids: [],
            },
          })
          fetchMock.post(`express:/tag/:id/projects`, {
            status: 204,
          })

          await waitFor(() => {
            const tagsDropdown = within(actionsToolbar).getByLabelText('Tags')
            fireEvent.click(tagsDropdown)
          })
          screen.getByText('Add to tag')

          const newTagButton = screen.getByText('Create new tag')
          fireEvent.click(newTagButton)

          const modal = screen.getAllByRole('dialog')[0]
          const input = within(modal).getByRole<HTMLInputElement>('textbox')
          fireEvent.change(input, {
            target: { value: this.newTagName },
          })
          const createButton = within(modal).getByRole('button', {
            name: 'Create',
          })
          fireEvent.click(createButton)

          await fetchMock.flush(true)

          expect(fetchMock.called('/tag', { name: this.newTagName })).to.be.true
          expect(
            fetchMock.called(`/tag/${this.newTagId}/projects`, {
              body: {
                projectIds: [projectsData[0].id, projectsData[1].id],
              },
            })
          ).to.be.true

          screen.getByRole('button', { name: `${this.newTagName} (2)` })
        })

        it('opens the tags dropdown and remove a tag from selected projects', async function () {
          const deleteProjectsFromTagMock = fetchMock.post(
            `express:/tag/:id/projects/remove`,
            {
              status: 204,
            }
          )
          screen.getByRole('button', { name: `${this.tagName} (2)` })

          const tagsDropdown = within(actionsToolbar).getByLabelText('Tags')
          fireEvent.click(tagsDropdown)
          within(actionsToolbar).getByText('Add to tag')

          const tagButton = within(actionsToolbar).getByLabelText(
            `Add or remove project from tag ${this.tagName}`
          )
          fireEvent.click(tagButton)

          await fetchMock.flush(true)

          expect(
            deleteProjectsFromTagMock.called(
              `/tag/${this.tagId}/projects/remove`,
              {
                body: {
                  projectIds: [projectsData[0].id, projectsData[1].id],
                },
              }
            )
          ).to.be.true
          screen.getByRole('button', { name: `${this.tagName} (0)` })
        })

        it('select another project, opens the tags dropdown and add a tag only to the untagged project', async function () {
          const addProjectsToTagMock = fetchMock.post(
            `express:/tag/:id/projects`,
            {
              status: 204,
            }
          )

          fireEvent.click(allCheckboxes[3])

          screen.getByRole('button', { name: `${this.tagName} (2)` })

          const tagsDropdown = within(actionsToolbar).getByLabelText('Tags')
          fireEvent.click(tagsDropdown)
          within(actionsToolbar).getByText('Add to tag')

          const tagButton = within(actionsToolbar).getByLabelText(
            `Add or remove project from tag ${this.tagName}`
          )
          fireEvent.click(tagButton)

          await fetchMock.flush(true)

          expect(
            addProjectsToTagMock.called(`/tag/${this.tagId}/projects`, {
              body: {
                projectIds: [projectsData[2].id],
              },
            })
          ).to.be.true
          screen.getByRole('button', { name: `${this.tagName} (3)` })
        })
      })

      describe('project tools', function () {
        it('renders download, archive, trash buttons followed by tags and "more" dropdowns when selecting an archived or trashed filter before selecting tag filter', function () {
          const assertToolbarButtonsExists = () => {
            within(actionsToolbar).getByLabelText(/download/i)
            within(actionsToolbar).getByLabelText(/archive/i)
            within(actionsToolbar).getByLabelText(/trash/i)
            within(actionsToolbar).getByLabelText(/tags/i)
            within(actionsToolbar).getByText(/more/i)
          }

          // Select archived projects
          const [archivedProjectsButton] =
            screen.getAllByText(/archived projects/i)
          fireEvent.click(archivedProjectsButton)
          const [tag] = screen.getAllByText(this.tagName)
          fireEvent.click(tag)

          allCheckboxes = screen.getAllByRole('checkbox')
          fireEvent.click(allCheckboxes[1])
          actionsToolbar = screen.getAllByRole('toolbar')[0]

          assertToolbarButtonsExists()

          // select trashed projects
          const [trashedProjectsButton] =
            screen.getAllByText(/trashed projects/i)
          fireEvent.click(trashedProjectsButton)
          fireEvent.click(tag)

          allCheckboxes = screen.getAllByRole('checkbox')
          fireEvent.click(allCheckboxes[1])
          actionsToolbar = screen.getAllByRole('toolbar')[0]

          assertToolbarButtonsExists()
        })

        describe('"More" dropdown', function () {
          beforeEach(async function () {
            const filterButton = screen.getAllByText('All Projects')[0]
            fireEvent.click(filterButton)
            allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          })

          it('does not show the dropdown when more than 1 project is selected', async function () {
            fireEvent.click(allCheckboxes[2]) // select a project

            const actionsToolbar = screen.getAllByRole('toolbar')[0]
            await waitFor(() => {
              within(actionsToolbar).getByText<HTMLElement>('More')
            })
            fireEvent.click(allCheckboxes[0]) // select all
            expect(within(actionsToolbar).queryByText<HTMLElement>('More')).to
              .be.null
          })

          it('validates the project name', async function () {
            fireEvent.click(allCheckboxes[1]) // select a project owned by the current user

            const actionsToolbar = screen.getAllByRole('toolbar')[0]
            const moreDropdown =
              await within(actionsToolbar).findByText<HTMLElement>('More')
            fireEvent.click(moreDropdown)

            const editButton =
              screen.getAllByText<HTMLButtonElement>('Rename')[0]
            fireEvent.click(editButton)

            const modals = await screen.findAllByRole('dialog')
            const modal = modals[0]

            expect(sendMBSpy).to.have.been.calledTwice
            expect(sendMBSpy).to.have.been.calledWith('loads_v2_dash')
            expect(sendMBSpy).to.have.been.calledWith(
              'project-list-page-interaction',
              {
                action: 'rename',
                page: '/',
                projectId: copyableProject.id,
                isSmallDevice: true,
              }
            )

            // same name
            let confirmButton =
              within(modal).getByText<HTMLButtonElement>('Rename')
            expect(confirmButton.disabled).to.be.true

            // no name
            const input = screen.getByLabelText('New Name') as HTMLButtonElement
            fireEvent.change(input, {
              target: { value: '' },
            })
            confirmButton = within(modal).getByText<HTMLButtonElement>('Rename')
            expect(confirmButton.disabled).to.be.true
          })

          it('opens the rename modal, and can rename the project, and view updated', async function () {
            fireEvent.click(allCheckboxes[1]) // select a project owned by the current user
            const actionsToolbar = screen.getAllByRole('toolbar')[0]

            const renameProjectMock = fetchMock.post(
              `express:/project/:id/rename`,
              {
                status: 200,
              }
            )
            const moreDropdown =
              await within(actionsToolbar).findByText<HTMLElement>('More')
            fireEvent.click(moreDropdown)

            const renameButton =
              within(actionsToolbar).getByText<HTMLButtonElement>('Rename')
            fireEvent.click(renameButton)

            const modals = await screen.findAllByRole('dialog')
            const modal = modals[0]

            // a valid name
            const newProjectName = 'A new project name'
            const input = (await within(modal).findByLabelText(
              'New Name'
            )) as HTMLButtonElement
            const oldName = input.value
            fireEvent.change(input, {
              target: { value: newProjectName },
            })

            const confirmButton =
              within(modal).getByText<HTMLButtonElement>('Rename')
            expect(confirmButton.disabled).to.be.false
            fireEvent.click(confirmButton)

            await fetchMock.flush(true)

            expect(
              renameProjectMock.called(`/project/${projectsData[0].id}/rename`)
            ).to.be.true

            const table = await screen.findByRole('table')
            within(table).getByText(newProjectName)
            expect(within(table).queryByText(oldName)).to.be.null

            const allCheckboxesInTable =
              await within(table).findAllByRole<HTMLInputElement>('checkbox')
            const allCheckboxesChecked = allCheckboxesInTable.filter(
              c => c.checked
            )
            expect(allCheckboxesChecked.length).to.equal(0)
          })

          it('opens the copy modal, can copy the project, and view updated', async function () {
            fireEvent.click(allCheckboxes[2])
            const actionsToolbar = screen.getAllByRole('toolbar')[0]

            const tableRows = screen.getAllByRole('row')
            const linkForProjectToCopy = within(tableRows[1]).getByRole('link')
            const projectNameToCopy = linkForProjectToCopy.textContent || '' // needed for type checking
            screen.getByText(projectNameToCopy) // make sure not just empty string
            const copiedProjectName = `${projectNameToCopy} (Copy)`
            const cloneProjectMock = fetchMock.post(
              `express:/project/:id/clone`,
              {
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
              }
            )

            await waitFor(() => {
              const moreDropdown =
                within(actionsToolbar).getByText<HTMLElement>('More')
              fireEvent.click(moreDropdown)
            })

            const copyButton =
              within(actionsToolbar).getByText<HTMLButtonElement>('Make a copy')
            fireEvent.click(copyButton)

            // confirm in modal
            const copyConfirmButton = document.querySelector(
              'button[type="submit"]'
            ) as HTMLElement
            fireEvent.click(copyConfirmButton)

            await fetchMock.flush(true)

            expect(
              cloneProjectMock.called(`/project/${projectsData[1].id}/clone`)
            ).to.be.true

            expect(sendMBSpy).to.have.been.calledTwice
            expect(sendMBSpy).to.have.been.calledWith('loads_v2_dash')
            expect(sendMBSpy).to.have.been.calledWith(
              'project-list-page-interaction',
              {
                action: 'clone',
                page: '/',
                projectId: archiveableProject.id,
                isSmallDevice: true,
              }
            )

            screen.getByText(copiedProjectName)
          })
        })
      })

      describe('projects list in actions modal', function () {
        let modal: HTMLElement
        let projectsToProcess: any[]

        function selectedProjectNames() {
          projectsToProcess = []
          // needs to be done ahead of opening modal

          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // update list so we know which are checked

          const tableRows = screen.getAllByRole('row')

          for (const [index, checkbox] of allCheckboxes.entries()) {
            if (checkbox.checked) {
              const linkForProjectToCopy = within(tableRows[index]).getByRole(
                'link'
              )
              const projectNameToCopy = linkForProjectToCopy.textContent
              projectsToProcess.push(projectNameToCopy)
            }
          }

          expect(projectsToProcess.length > 0).to.be.true
        }

        function selectedMatchesDisplayed(expectedLength: number) {
          selectedProjectNames()
          // any action will work for check since they all use the same modal
          const archiveButton = within(actionsToolbar).getByLabelText('Archive')
          fireEvent.click(archiveButton)
          modal = screen.getAllByRole('dialog')[0]

          const listitems = within(modal).getAllByRole('listitem')
          expect(listitems.length).to.equal(projectsToProcess.length)
          expect(listitems.length).to.equal(expectedLength)

          for (const projectName of projectsToProcess) {
            within(modal).getByText(projectName)
          }
        }

        beforeEach(function () {
          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // first one is the select all checkbox, just check 2 at first
          fireEvent.click(allCheckboxes[1])
          fireEvent.click(allCheckboxes[2])

          actionsToolbar = screen.getAllByRole('toolbar')[0]
        })

        it('opens the modal with the 2 originally selected projects', function () {
          selectedMatchesDisplayed(2)
        })

        it('shows correct list after closing modal, changing selecting, and reopening modal', async function () {
          selectedMatchesDisplayed(2)

          const modal = screen.getAllByRole('dialog', { hidden: false })[0]
          const cancelButton = within(modal).getByRole('button', {
            name: 'Cancel',
          })
          fireEvent.click(cancelButton)
          expect(screen.queryByRole('dialog', { hidden: false })).to.be.null

          await screen.findAllByRole('checkbox')
          fireEvent.click(allCheckboxes[3])
          selectedMatchesDisplayed(3)
        })

        it('maintains original list even after some have been processed', async function () {
          const totalProjectsToProcess = 2
          selectedMatchesDisplayed(totalProjectsToProcess)
          const button = screen.getByRole('button', { name: 'Confirm' })
          fireEvent.click(button)
          project1Id = allCheckboxes[1].getAttribute('data-project-id')
          fetchMock.post('express:/project/:id/archive', {
            status: 200,
          })
          fetchMock.post(`/project/${project2Id}/archive`, {
            status: 500,
          })

          await screen.findByRole('alert') // ensure that error was thrown for the 2nd project
          const listitems = within(modal).getAllByRole('listitem')
          expect(listitems.length).to.equal(totalProjectsToProcess)
        })
      })
    })

    describe('search', function () {
      it('shows only projects based on the input', async function () {
        const input = screen.getAllByRole('textbox', {
          name: /search in all projects/i,
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
        const copyButton = within(tableRows[1]).getAllByRole('button', {
          name: 'Copy',
        })[0]
        fireEvent.click(copyButton)

        // confirm in modal
        const copyConfirmButton = document.querySelector(
          'button[type="submit"]'
        ) as HTMLElement
        fireEvent.click(copyConfirmButton)

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        expect(sendMBSpy).to.have.been.calledTwice
        expect(sendMBSpy).to.have.been.calledWith('loads_v2_dash')
        expect(sendMBSpy).to.have.been.calledWith(
          'project-list-page-interaction',
          {
            action: 'clone',
            page: '/',
            projectId: archiveableProject.id,
            isSmallDevice: true,
          }
        )

        expect(screen.queryByText(copiedProjectName)).to.be.null

        const yourProjectFilter = screen.getAllByText('Your Projects')[0]
        fireEvent.click(yourProjectFilter)
        await screen.findByText(copiedProjectName)
      })
    })

    describe('notifications', function () {
      it('email confirmation alert is displayed', async function () {
        screen.getByText(
          'Please confirm your email test@overleaf.com by clicking on the link in the confirmation email'
        )
      })
    })
  })
})
