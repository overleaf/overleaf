import _ from 'lodash'
import { useCallback, useState } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import ColorManager from '../../../../ide/colors/ColorManager'
import Icon from '../../../../shared/components/icon'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import CreateTagModal from './create-tag-modal'
import DeleteTagModal from './delete-tag-modal'
import RenameTagModal from './rename-tag-modal'

export default function TagsList() {
  const { t } = useTranslation()
  const {
    tags,
    untaggedProjectsCount,
    selectedTagId,
    selectTag,
    addTag,
    renameTag,
    deleteTag,
  } = useProjectListContext()

  const [creatingTag, setCreatingTag] = useState<boolean>(false)
  const [renamingTag, setRenamingTag] = useState<Tag>()
  const [deletingTag, setDeletingTag] = useState<Tag>()

  const handleSelectTag = useCallback(
    (e, tagId) => {
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
    },
    [addTag]
  )

  const handleRenameTag = useCallback(
    (e, tagId) => {
      e.preventDefault()
      const tag = _.find(tags, ['_id', tagId])
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
      const tag = _.find(tags, ['_id', tagId])
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

  return (
    <>
      <li className="separator">
        <h2>{t('tags_slash_folders')}</h2>
      </li>
      <li className="tag">
        <Button className="tag-name" onClick={openCreateTagModal}>
          <Icon type="plus" />
          <span className="name">{t('new_folder')}</span>
        </Button>
      </li>
      {_.sortBy(tags, ['name']).map((tag, index) => {
        return (
          <li
            className={`tag ${selectedTagId === tag._id ? 'active' : ''}`}
            key={index}
          >
            <Button
              className="tag-name"
              onClick={e => handleSelectTag(e, tag._id)}
            >
              <span
                style={{
                  color: `hsl(${ColorManager.getHueForTagId(
                    tag._id
                  )}, 70%, 45%)`,
                }}
              >
                <Icon
                  type={selectedTagId === tag._id ? 'folder-open' : 'folder'}
                />
              </span>
              <span className="name">
                {tag.name}{' '}
                <span className="subdued"> ({tag.project_ids?.length})</span>
              </span>
            </Button>
            <span className="dropdown tag-menu">
              <button
                className="dropdown-toggle"
                data-toggle="dropdown"
                dropdown-toggle=""
                aria-haspopup="true"
                aria-expanded="false"
              >
                <span className="caret" />
              </button>
              <ul className="dropdown-menu dropdown-menu-right" role="menu">
                <li>
                  <Button
                    onClick={e => handleRenameTag(e, tag._id)}
                    className="tag-action"
                  >
                    {t('rename')}
                  </Button>
                </li>
                <li>
                  <Button
                    onClick={e => handleDeleteTag(e, tag._id)}
                    className="tag-action"
                  >
                    {t('delete')}
                  </Button>
                </li>
              </ul>
            </span>
          </li>
        )
      })}
      <li
        className={`tag untagged ${
          selectedTagId === UNCATEGORIZED_KEY ? 'active' : ''
        }`}
      >
        <Button
          className="tag-name"
          onClick={() => selectTag(UNCATEGORIZED_KEY)}
        >
          <span className="name">{t('uncategorized')}</span>
          <span className="subdued"> ({untaggedProjectsCount})</span>
        </Button>
      </li>
      <CreateTagModal
        show={creatingTag}
        onCreate={onCreate}
        onClose={() => setCreatingTag(false)}
      />
      <RenameTagModal
        tag={renamingTag}
        onRename={onRename}
        onClose={() => setRenamingTag(undefined)}
      />
      <DeleteTagModal
        tag={deletingTag}
        onDelete={onDelete}
        onClose={() => setDeletingTag(undefined)}
      />
    </>
  )
}
