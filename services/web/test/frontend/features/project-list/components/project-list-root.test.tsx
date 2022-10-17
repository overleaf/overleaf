import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import ProjectListRoot from '../../../../../frontend/js/features/project-list/components/project-list-root'
import { renderWithProjectListContext } from '../helpers/render-with-context'
import * as eventTracking from '../../../../../frontend/js/infrastructure/event-tracking'
import {
  projectsData,
  owner,
  archivedProjects,
  makeLongProjectList,
} from '../fixtures/projects-data'
const { fullList, currentList, trashedList } = makeLongProjectList(40)

const userId = owner.id

describe('<ProjectListRoot />', function () {
  const originalLocation = window.location
  const locationStub = sinon.stub()
  let sendSpy: sinon.SinonSpy

  beforeEach(async function () {
    global.localStorage.clear()
    sendSpy = sinon.spy(eventTracking, 'send')
    window.metaAttributesCache = new Map()
    this.tagId = '999fff999fff'
    this.tagName = 'First tag name'
    window.metaAttributesCache.set('ol-tags', [
      {
        _id: this.tagId,
        name: this.tagName,
        project_ids: [projectsData[0].id, projectsData[1].id],
      },
    ])
    window.metaAttributesCache.set('ol-ExposedSettings', {
      templateLinks: [],
    })
    window.metaAttributesCache.set('ol-userEmails', [
      { email: 'test@overleaf.com', default: true },
    ])
    window.user_id = userId

    Object.defineProperty(window, 'location', {
      value: { assign: locationStub },
    })
  })

  afterEach(function () {
    sendSpy.restore()
    window.user_id = undefined
    fetchMock.reset()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    })
  })

  describe('welcome page', function () {
    beforeEach(async function () {
      renderWithProjectListContext(<ProjectListRoot />, {
        projects: [],
      })
      await fetchMock.flush(true)
    })

    it('the welcome page is displayed', async function () {
      screen.getByRole('heading', { name: 'Welcome to Overleaf!' })
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
      renderWithProjectListContext(<ProjectListRoot />, {
        projects: fullList,
      })
      await fetchMock.flush(true)
      await waitFor(() => {
        screen.findByRole('table')
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
          const downloadButton =
            within(actionsToolbar).getByLabelText('Download')
          fireEvent.click(downloadButton)

          await waitFor(() => {
            expect(locationStub).to.have.been.called
          })

          sinon.assert.calledWithMatch(
            locationStub,
            `/project/download/zip?project_ids=${project1Id},${project2Id}`
          )

          const allCheckboxes =
            screen.getAllByRole<HTMLInputElement>('checkbox')
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

          await waitFor(
            () =>
              expect(fetchMock.called(`/project/${project1Id}/archive`)).to.be
                .true
          )
          await waitFor(
            () =>
              expect(fetchMock.called(`/project/${project2Id}/archive`)).to.be
                .true
          )
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

          await waitFor(
            () =>
              expect(fetchMock.called(`/project/${project1Id}/trash`)).to.be
                .true
          )
          await waitFor(
            () =>
              expect(fetchMock.called(`/project/${project2Id}/trash`)).to.be
                .true
          )
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
          screen.getByText('Add to folder')

          const newTagButton = screen.getByText('Create New Folder')
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

          await waitFor(
            () =>
              expect(fetchMock.called('/tag', { name: this.newTagName })).to.be
                .true
          )
          await waitFor(
            () =>
              expect(
                fetchMock.called(`/tag/${this.newTagId}/projects`, {
                  body: {
                    projectIds: [projectsData[0].id, projectsData[1].id],
                  },
                })
              ).to.be.true
          )

          screen.getByRole('button', { name: `${this.newTagName} (2)` })
        })

        it('opens the tags dropdown and remove a tag from selected projects', async function () {
          const deleteProjectsFromTagMock = fetchMock.delete(
            `express:/tag/:id/projects`,
            {
              status: 204,
            }
          )

          screen.getByRole('button', { name: `${this.tagName} (2)` })

          const tagsDropdown = within(actionsToolbar).getByLabelText('Tags')
          fireEvent.click(tagsDropdown)
          screen.getByText('Add to folder')

          const tagButton = screen.getByLabelText(
            `Add or remove project from tag ${this.tagName}`
          )
          fireEvent.click(tagButton)

          await waitFor(
            () =>
              expect(
                deleteProjectsFromTagMock.called(
                  `/tag/${this.tagId}/projects`,
                  {
                    body: {
                      projectIds: [projectsData[0].id, projectsData[1].id],
                    },
                  }
                )
              ).to.be.true
          )

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
          screen.getByText('Add to folder')

          const tagButton = screen.getByLabelText(
            `Add or remove project from tag ${this.tagName}`
          )
          fireEvent.click(tagButton)

          await waitFor(
            () =>
              expect(
                addProjectsToTagMock.called(`/tag/${this.tagId}/projects`, {
                  body: {
                    projectIds: [projectsData[2].id],
                  },
                })
              ).to.be.true
          )

          screen.getByRole('button', { name: `${this.tagName} (3)` })
        })
      })

      describe('project tools "More" dropdown', function () {
        beforeEach(async function () {
          const filterButton = screen.getAllByText('All Projects')[0]
          fireEvent.click(filterButton)
          allCheckboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
          // first one is the select all checkbox
          fireEvent.click(allCheckboxes[2])
          actionsToolbar = screen.getAllByRole('toolbar')[0]
        })

        it('does not show the dropdown when more than 1 project is selected', async function () {
          await waitFor(() => {
            within(actionsToolbar).getByText<HTMLElement>('More')
          })
          fireEvent.click(allCheckboxes[0])
          expect(within(actionsToolbar).queryByText<HTMLElement>('More')).to.be
            .null
        })

        it('opens the rename modal, and can rename the project, and view updated', async function () {
          const renameProjectMock = fetchMock.post(
            `express:/project/:id/rename`,
            {
              status: 200,
            }
          )

          await waitFor(() => {
            const moreDropdown =
              within(actionsToolbar).getByText<HTMLElement>('More')
            fireEvent.click(moreDropdown)
          })

          const renameButton =
            screen.getAllByText<HTMLInputElement>('Rename')[1] // first one is for the tag in the sidebar
          fireEvent.click(renameButton)

          const modal = screen.getAllByRole('dialog')[0]

          expect(sendSpy).to.be.calledOnce
          expect(sendSpy).calledWith('project-list-page-interaction')

          // same name
          let confirmButton =
            within(modal).getByText<HTMLInputElement>('Rename')
          expect(confirmButton.disabled).to.be.true
          let input = screen.getByLabelText('New Name') as HTMLButtonElement
          const oldName = input.value

          // no name
          let newProjectName = ''
          input = screen.getByLabelText('New Name') as HTMLButtonElement
          fireEvent.change(input, {
            target: { value: newProjectName },
          })
          confirmButton = within(modal).getByText<HTMLInputElement>('Rename')
          expect(confirmButton.disabled).to.be.true

          // a valid name
          newProjectName = 'A new project name'
          input = screen.getByLabelText('New Name') as HTMLButtonElement
          fireEvent.change(input, {
            target: { value: newProjectName },
          })

          confirmButton = within(modal).getByText<HTMLInputElement>('Rename')
          expect(confirmButton.disabled).to.be.false
          fireEvent.click(confirmButton)

          await waitFor(
            () =>
              expect(
                renameProjectMock.called(
                  `/project/${projectsData[1].id}/rename`
                )
              ).to.be.true
          )

          screen.findByText(newProjectName)
          expect(screen.queryByText(oldName)).to.be.null

          const allCheckboxes =
            screen.getAllByRole<HTMLInputElement>('checkbox')
          const allCheckboxesChecked = allCheckboxes.filter(c => c.checked)
          expect(allCheckboxesChecked.length).to.equal(0)
        })

        it('opens the copy modal, can copy the project, and view updated', async function () {
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
            within(actionsToolbar).getByText<HTMLInputElement>('Make a copy')
          fireEvent.click(copyButton)

          // confirm in modal
          const copyConfirmButton = document.querySelector(
            'button[type="submit"]'
          ) as HTMLElement
          fireEvent.click(copyConfirmButton)

          await waitFor(
            () =>
              expect(
                cloneProjectMock.called(`/project/${projectsData[1].id}/clone`)
              ).to.be.true
          )

          expect(sendSpy).to.be.calledOnce
          expect(sendSpy).calledWith('project-list-page-interaction')

          screen.getByText(copiedProjectName)
        })
      })
    })

    describe('search', function () {
      it('shows only projects based on the input', async function () {
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
        const copyConfirmButton = document.querySelector(
          'button[type="submit"]'
        ) as HTMLElement
        fireEvent.click(copyConfirmButton)

        await fetchMock.flush(true)
        expect(fetchMock.done()).to.be.true

        expect(sendSpy).to.be.calledOnce
        expect(sendSpy).calledWith('project-list-page-interaction')

        expect(screen.queryByText(copiedProjectName)).to.be.null

        const yourProjectFilter = screen.getAllByText('Your Projects')[0]
        fireEvent.click(yourProjectFilter)
        screen.findByText(copiedProjectName)
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
