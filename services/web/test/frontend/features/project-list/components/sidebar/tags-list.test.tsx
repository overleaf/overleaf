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

    fetchMock.post('/tag', {
      _id: 'eee888eee888',
      name: 'New Tag',
      project_ids: [],
    })
    fetchMock.post('express:/tag/:tagId/projects', 200)
    fetchMock.post('express:/tag/:tagId/edit', 200)
    fetchMock.delete('express:/tag/:tagId', 200)

    renderWithProjectListContext(<TagsList />)

    await fetchMock.flush(true)
    await waitFor(() => expect(fetchMock.called('/api/project')))
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('displays the tags list', function () {
    const header = screen.getByTestId('organize-projects')
    expect(header.textContent).to.equal('Organize Tags')

    screen.getByRole('button', {
      name: 'New Tag',
    })
    screen.getByRole('button', {
      name: 'Tag 1 (1)',
    })
    screen.getByRole('button', {
      name: 'Another tag (2)',
    })
    screen.getByRole('button', {
      name: 'Uncategorized (3)',
    })
  })

  it('selects the tag when clicked', async function () {
    const tag1Button = screen.getByText('Tag 1')
    assert.isFalse(tag1Button.closest('li')?.classList.contains('active'))

    await fireEvent.click(tag1Button)
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
        name: 'New Tag',
      })

      await fireEvent.click(newTagButton)
    })

    it('modal is open', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      within(modal).getByRole('heading', { name: 'Create new tag' })
    })

    it('click on cancel closes the modal', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const cancelButton = within(modal).getByRole('button', { name: 'Cancel' })

      await fireEvent.click(cancelButton)
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
      fireEvent.change(input, { target: { value: 'New Tag' } })

      const createButton = within(modal).getByRole('button', { name: 'Create' })
      expect(createButton.hasAttribute('disabled')).to.be.false

      await fireEvent.click(createButton)

      await waitFor(() => expect(fetchMock.called(`/tag`)).to.be.true)

      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null

      screen.getByRole('button', {
        name: 'New Tag (0)',
      })
    })
  })

  describe('Edit modal', function () {
    beforeEach(async function () {
      const tag1Button = screen.getByText('Tag 1')
      const dropdownToggle = within(
        tag1Button.closest('li') as HTMLElement
      ).getByTestId('tag-dropdown-toggle')
      await fireEvent.click(dropdownToggle)
      const editMenuItem = await screen.findByRole('menuitem', { name: 'Edit' })
      await fireEvent.click(editMenuItem)
    })

    it('modal is open', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      within(modal).getByRole('heading', { name: 'Edit Tag' })
    })

    it('click on cancel closes the modal', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const cancelButton = within(modal).getByRole('button', { name: 'Cancel' })

      await fireEvent.click(cancelButton)
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
      fireEvent.change(input, { target: { value: 'New Tag Name' } })

      const saveButton = within(modal).getByRole('button', { name: 'Save' })
      expect(saveButton.hasAttribute('disabled')).to.be.false

      await fireEvent.click(saveButton)

      await waitFor(() => expect(fetchMock.called(`/tag/abc123def456/rename`)))

      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null

      screen.getByRole('button', {
        name: 'New Tag Name (1)',
      })
    })
  })

  describe('Delete modal', function () {
    beforeEach(async function () {
      const tag1Button = screen.getByText('Tag 1')
      const dropdownToggle = within(
        tag1Button.closest('li') as HTMLElement
      ).getByTestId('tag-dropdown-toggle')
      await fireEvent.click(dropdownToggle)
      const deleteMenuItem = await screen.findByRole('menuitem', {
        name: 'Delete',
      })
      await fireEvent.click(deleteMenuItem)
    })

    it('modal is open', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      within(modal).getByRole('heading', { name: 'Delete Tag' })
    })

    it('click on Cancel closes the modal', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const cancelButton = within(modal).getByRole('button', { name: 'Cancel' })

      await fireEvent.click(cancelButton)
      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
    })

    it('clicking Delete sends a request', async function () {
      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const deleteButton = within(modal).getByRole('button', { name: 'Delete' })
      await fireEvent.click(deleteButton)

      await waitFor(() => expect(fetchMock.called(`/tag/bcd234efg567`)))

      expect(screen.queryByRole('dialog', { hidden: false })).to.be.null
      expect(
        screen.queryByRole('button', {
          name: 'Another Tag (2)',
        })
      ).to.be.null
    })

    it('a failed request displays an error message', async function () {
      fetchMock.delete('express:/tag/:tagId', 500, { overwriteRoutes: true })

      const modal = screen.getAllByRole('dialog', { hidden: false })[0]
      const deleteButton = within(modal).getByRole('button', { name: 'Delete' })
      await fireEvent.click(deleteButton)

      await waitFor(() => expect(fetchMock.called(`/tag/bcd234efg567`)))

      within(modal).getByText('Sorry, something went wrong')
    })
  })
})
