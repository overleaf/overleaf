import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { assert, expect } from 'chai'
import fetchMock from 'fetch-mock'
import TagsList from '../../../../../../frontend/js/features/project-list/components/sidebar/tags-list'
import { projectsData } from '../../fixtures/projects-data'
import { renderWithProjectListContext } from '../../helpers/render-with-context'

describe('<TagsList />', function () {
  beforeEach(async function () {
    global.localStorage.clear()
    window.metaAttributesCache.set('ol-tags', [
      {
        _id: 'abc123def456',
        name: 'Tag 1',
        project_ids: [projectsData[0].id],
      },
      {
        _id: 'bcd234efg567',
        name: 'Another tag',
        project_ids: [projectsData[0].id, projectsData[1].id],
      },
    ])
    window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: true })

    fetchMock.post('/tag', {
      _id: 'eee888eee888',
      name: 'New tag',
      project_ids: [],
    })
    fetchMock.post('express:/tag/:tagId/projects', 200)
    fetchMock.post('express:/tag/:tagId/edit', 200)
    fetchMock.delete('express:/tag/:tagId', 200, { name: 'delete tag' })

    renderWithProjectListContext(<TagsList />)

    await fetchMock.callHistory.flush(true)
    await waitFor(
      () => expect(fetchMock.callHistory.called('/api/project')).to.be.true
    )
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('displays the tags list', async function () {
    const header = await screen.findByTestId('organize-projects')
    expect(header.textContent).to.equal('Organize Tags')

    await screen.findByRole('button', {
      name: 'New tag',
    })
    await screen.findByRole('button', {
      name: 'Tag 1 (1)',
    })
    await screen.findByRole('button', {
      name: 'Another tag (2)',
    })
    await screen.findByRole('button', {
      name: 'Uncategorized (3)',
    })
  })

  it('selects the tag when clicked', async function () {
    const tag1Button = screen.getByText('Tag 1')
    assert.isFalse(tag1Button.closest('li')?.classList.contains('active'))

    fireEvent.click(tag1Button)
    assert.isTrue(tag1Button.closest('li')?.classList.contains('active'))
  })

  it('selects uncategorized when clicked', function () {
    const uncategorizedButton = screen.getByText('Uncategorized')
    assert.isFalse(
      uncategorizedButton.closest('li')?.classList.contains('active')
    )

    fireEvent.click(uncategorizedButton)
    assert.isTrue(
      uncategorizedButton.closest('li')?.classList.contains('active')
    )
  })

  describe('Create modal', function () {
    beforeEach(async function () {
      const newTagButton = screen.getByRole('button', {
        name: 'New tag',
      })

      fireEvent.click(newTagButton)
    })

    it('modal is open', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      within(modal).getByRole('heading', { name: 'Create new tag' })
    })

    it('click on cancel closes the modal', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const cancelButton = within(modal).getByRole('button', { name: 'Cancel' })

      fireEvent.click(cancelButton)
      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
    })

    it('Create button is disabled when input is empty', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const createButton = within(modal).getByRole('button', { name: 'Create' })

      expect(createButton.hasAttribute('disabled')).to.be.true
    })

    it('Create button is disabled with error message when tag name is too long', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, {
        target: {
          value: 'This is a very very very very very very long tag name',
        },
      })

      const createButton = within(modal).getByRole('button', { name: 'Create' })
      expect(createButton.hasAttribute('disabled')).to.be.true
      screen.getByText('Tag name cannot exceed 50 characters')
    })

    it('Create button is disabled with error message when tag name is already used', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, {
        target: {
          value: 'Tag 1',
        },
      })

      const createButton = within(modal).getByRole('button', { name: 'Create' })
      expect(createButton.hasAttribute('disabled')).to.be.true
      screen.getByText('Tag "Tag 1" already exists')
    })

    it('filling the input and clicking Create sends a request', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New tag' } })

      const createButton = within(modal).getByRole('button', { name: 'Create' })
      expect(createButton.hasAttribute('disabled')).to.be.false

      fireEvent.click(createButton)

      await waitFor(
        () => expect(fetchMock.callHistory.called(`/tag`)).to.be.true
      )

      await waitFor(
        () => expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
      )

      screen.getByRole('button', {
        name: 'New tag (0)',
      })
    })
  })

  describe('Edit modal', function () {
    beforeEach(async function () {
      const tag1Button = screen.getByText('Tag 1')
      const dropdownToggle = within(
        tag1Button.closest('li') as HTMLElement
      ).getByTestId('tag-dropdown-toggle')
      fireEvent.click(dropdownToggle)
      const editMenuItem = await screen.findByRole('menuitem', { name: 'Edit' })
      fireEvent.click(editMenuItem)
    })

    it('modal is open', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      within(modal).getByRole('heading', { name: 'Edit tag' })
    })

    it('click on cancel closes the modal', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const cancelButton = within(modal).getByRole('button', { name: 'Cancel' })

      fireEvent.click(cancelButton)
      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
    })

    it('Save button is disabled when input is empty', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, {
        target: {
          value: '',
        },
      })
      const saveButton = within(modal).getByRole('button', { name: 'Save' })

      expect(saveButton.hasAttribute('disabled')).to.be.true
    })

    it('Save button is disabled with error message when tag name is too long', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, {
        target: {
          value: 'This is a very very very very very very long tag name',
        },
      })

      const saveButton = within(modal).getByRole('button', { name: 'Save' })
      expect(saveButton.hasAttribute('disabled')).to.be.true
      screen.getByText('Tag name cannot exceed 50 characters')
    })

    it('Save button is disabled with no error message when tag name is unchanged', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const saveButton = within(modal).getByRole('button', { name: 'Save' })
      expect(saveButton.hasAttribute('disabled')).to.be.true
    })

    it('Save button is disabled with error message when tag name is already used', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, {
        target: {
          value: 'Another tag',
        },
      })

      const saveButton = within(modal).getByRole('button', { name: 'Save' })
      expect(saveButton.hasAttribute('disabled')).to.be.true
      screen.getByText('Tag "Another tag" already exists')
    })

    it('filling the input and clicking Save sends a request', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const input = within(modal).getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New tag Name' } })

      const saveButton = within(modal).getByRole('button', { name: 'Save' })
      expect(saveButton.hasAttribute('disabled')).to.be.false

      fireEvent.click(saveButton)

      await waitFor(
        () =>
          expect(fetchMock.callHistory.called(`/tag/abc123def456/edit`)).to.be
            .true
      )

      await waitFor(
        () => expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
      )

      screen.getByRole('button', {
        name: 'New tag Name (1)',
      })
    })
  })

  describe('Delete modal', function () {
    beforeEach(async function () {
      const tag1Button = screen.getByText('Tag 1')
      const dropdownToggle = within(
        tag1Button.closest('li') as HTMLElement
      ).getByTestId('tag-dropdown-toggle')
      fireEvent.click(dropdownToggle)
      const deleteMenuItem = await screen.findByRole('menuitem', {
        name: 'Delete',
      })
      fireEvent.click(deleteMenuItem)
    })

    it('modal is open', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      within(modal).getByRole('heading', { name: 'Delete Tag' })
    })

    it('click on Cancel closes the modal', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const cancelButton = within(modal).getByRole('button', { name: 'Cancel' })

      fireEvent.click(cancelButton)
      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
    })

    it('clicking Delete sends a request', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const deleteButton = within(modal).getByRole('button', { name: 'Delete' })
      fireEvent.click(deleteButton)

      await waitFor(
        () =>
          expect(fetchMock.callHistory.called(`/tag/abc123def456`)).to.be.true
      )

      await waitFor(
        () => expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
      )
      expect(
        screen.queryByRole('button', {
          name: 'Another Tag (2)',
        })
      ).to.be.null
    })

    it('a failed request displays an error message', async function () {
      fetchMock.modifyRoute('delete tag', { response: { status: 500 } })

      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const deleteButton = within(modal).getByRole('button', { name: 'Delete' })
      fireEvent.click(deleteButton)

      await waitFor(
        () =>
          expect(fetchMock.callHistory.called('/tag/abc123def456')).to.be.true
      )

      await within(modal).findByText('Sorry, something went wrong')
    })
  })
})
