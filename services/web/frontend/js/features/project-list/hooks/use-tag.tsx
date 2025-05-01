import { useState, useCallback } from 'react'
import { useProjectListContext } from '../context/project-list-context'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import CreateTagModal from '../components/modals/create-tag-modal'
import { EditTagModal } from '../components/modals/edit-tag-modal'
import DeleteTagModal from '../components/modals/delete-tag-modal'
import { ManageTagModal } from '../components/modals/manage-tag-modal'
import { find } from 'lodash'
import { addProjectsToTag } from '../util/api'

function useTag() {
  const {
    tags,
    selectTag,
    addTag,
    updateTag,
    deleteTag,
    selectedProjects,
    addProjectToTagInView,
  } = useProjectListContext()
  const [creatingTag, setCreatingTag] = useState<boolean>(false)
  const [editingTag, setEditingTag] = useState<Tag>()
  const [deletingTag, setDeletingTag] = useState<Tag>()

  const handleSelectTag = useCallback(
    (e: React.MouseEvent, tagId: string) => {
      e.preventDefault()
      selectTag(tagId)
    },
    [selectTag]
  )

  const openCreateTagModal = useCallback(() => {
    setCreatingTag(true)
  }, [setCreatingTag])

  const onCreate = useCallback(
    (tag: Tag) => {
      setCreatingTag(false)
      addTag(tag)
      for (const selectedProject of selectedProjects) {
        addProjectToTagInView(tag._id, selectedProject.id)
      }
      addProjectsToTag(
        tag._id,
        selectedProjects.map(project => project.id)
      )
    },
    [addTag, selectedProjects, addProjectToTagInView]
  )

  const handleEditTag = useCallback(
    (e: React.MouseEvent, tagId: string) => {
      e.preventDefault()
      const tag = find(tags, ['_id', tagId])
      if (tag) {
        setEditingTag(tag)
      }
    },
    [tags, setEditingTag]
  )

  const onUpdate = useCallback(
    (tagId: string, newTagName: string, newTagColor?: string) => {
      updateTag(tagId, newTagName, newTagColor)
      setEditingTag(undefined)
    },
    [updateTag, setEditingTag]
  )

  const handleDeleteTag = useCallback(
    (e: React.MouseEvent, tagId: string) => {
      e.preventDefault()
      const tag = find(tags, ['_id', tagId])
      if (tag) {
        setDeletingTag(tag)
      }
    },
    [tags, setDeletingTag]
  )

  const onDelete = useCallback(
    (tagId: string) => {
      deleteTag(tagId)
      setDeletingTag(undefined)
    },
    [deleteTag, setDeletingTag]
  )

  const handleManageTag = useCallback(
    (e: React.MouseEvent, tagId: string) => {
      e.preventDefault()
      const tag = find(tags, ['_id', tagId])
      if (tag) {
        setEditingTag(tag)
      }
    },
    [tags, setEditingTag]
  )

  const onManageEdit = useCallback(
    (tagId: string, newTagName: string, newTagColor?: string) => {
      updateTag(tagId, newTagName, newTagColor)
      setEditingTag(undefined)
    },
    [updateTag, setEditingTag]
  )

  const onManageDelete = useCallback(
    (tagId: string) => {
      deleteTag(tagId)
      setEditingTag(undefined)
    },
    [deleteTag, setEditingTag]
  )

  function CreateModal({
    id,
    disableCustomColor,
  }: {
    id: string
    disableCustomColor?: boolean
  }) {
    return (
      <CreateTagModal
        id={id}
        show={creatingTag}
        onCreate={onCreate}
        onClose={() => setCreatingTag(false)}
        disableCustomColor={disableCustomColor}
      />
    )
  }

  function EditModal({ id }: { id: string }) {
    return (
      <EditTagModal
        id={id}
        tag={editingTag}
        onEdit={onUpdate}
        onClose={() => setEditingTag(undefined)}
      />
    )
  }

  function DeleteModal({ id }: { id: string }) {
    return (
      <DeleteTagModal
        id={id}
        tag={deletingTag}
        onDelete={onDelete}
        onClose={() => setDeletingTag(undefined)}
      />
    )
  }

  function ManageModal({ id }: { id: string }) {
    return (
      <ManageTagModal
        id={id}
        tag={editingTag}
        onEdit={onManageEdit}
        onDelete={onManageDelete}
        onClose={() => setEditingTag(undefined)}
      />
    )
  }

  return {
    handleSelectTag,
    openCreateTagModal,
    handleEditTag,
    handleDeleteTag,
    handleManageTag,
    CreateTagModal: CreateModal,
    EditTagModal: EditModal,
    DeleteTagModal: DeleteModal,
    ManageTagModal: ManageModal,
  }
}

export default useTag
