import { useState, useCallback } from 'react'
import { useProjectListContext } from '../context/project-list-context'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import CreateTagModal from '../components/modals/create-tag-modal'
import RenameTagModal from '../components/modals/rename-tag-modal'
import DeleteTagModal from '../components/modals/delete-tag-modal'
import EditTagModal from '../components/modals/edit-tag-modal'
import { find } from 'lodash'
import { addProjectsToTag } from '../util/api'

function useTag() {
  const {
    tags,
    selectTag,
    addTag,
    renameTag,
    deleteTag,
    selectedProjects,
    addProjectToTagInView,
  } = useProjectListContext()
  const [creatingTag, setCreatingTag] = useState<boolean>(false)
  const [renamingTag, setRenamingTag] = useState<Tag>()
  const [deletingTag, setDeletingTag] = useState<Tag>()
  const [editingTag, setEditingTag] = useState<Tag>()

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

  const handleRenameTag = useCallback(
    (e, tagId) => {
      e.preventDefault()
      const tag = find(tags, ['_id', tagId])
      if (tag) {
        setRenamingTag(tag)
      }
    },
    [tags, setRenamingTag]
  )

  const onRename = useCallback(
    (tagId: string, newTagName: string) => {
      renameTag(tagId, newTagName)
      setRenamingTag(undefined)
    },
    [renameTag, setRenamingTag]
  )

  const handleDeleteTag = useCallback(
    (e, tagId) => {
      e.preventDefault()
      const tag = find(tags, ['_id', tagId])
      if (tag) {
        setDeletingTag(tag)
      }
    },
    [tags, setDeletingTag]
  )

  const onDelete = useCallback(
    tagId => {
      deleteTag(tagId)
      setDeletingTag(undefined)
    },
    [deleteTag, setDeletingTag]
  )

  const handleEditTag = useCallback(
    (e, tagId) => {
      e.preventDefault()
      const tag = find(tags, ['_id', tagId])
      if (tag) {
        setEditingTag(tag)
      }
    },
    [tags, setEditingTag]
  )

  const onEditRename = useCallback(
    (tagId: string, newTagName: string) => {
      renameTag(tagId, newTagName)
      setEditingTag(undefined)
    },
    [renameTag, setEditingTag]
  )

  const onEditDelete = useCallback(
    (tagId: string) => {
      deleteTag(tagId)
      setEditingTag(undefined)
    },
    [deleteTag, setEditingTag]
  )

  function CreateModal({ id }: { id: string }) {
    return (
      <CreateTagModal
        id={id}
        show={creatingTag}
        onCreate={onCreate}
        onClose={() => setCreatingTag(false)}
      />
    )
  }

  function RenameModal({ id }: { id: string }) {
    return (
      <RenameTagModal
        id={id}
        tag={renamingTag}
        onRename={onRename}
        onClose={() => setRenamingTag(undefined)}
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

  function EditModal({ id }: { id: string }) {
    return (
      <EditTagModal
        id={id}
        tag={editingTag}
        onRename={onEditRename}
        onDelete={onEditDelete}
        onClose={() => setEditingTag(undefined)}
      />
    )
  }

  return {
    handleSelectTag,
    openCreateTagModal,
    handleRenameTag,
    handleDeleteTag,
    handleEditTag,
    CreateTagModal: CreateModal,
    RenameTagModal: RenameModal,
    DeleteTagModal: DeleteModal,
    EditTagModal: EditModal,
  }
}

export default useTag
