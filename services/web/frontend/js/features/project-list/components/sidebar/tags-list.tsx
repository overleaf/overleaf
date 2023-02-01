import { sortBy } from 'lodash'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import ColorManager from '../../../../ide/colors/ColorManager'
import Icon from '../../../../shared/components/icon'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import useTag from '../../hooks/use-tag'

export default function TagsList() {
  const { t } = useTranslation()
  const {
    tags,
    projectsPerTag,
    untaggedProjectsCount,
    selectedTagId,
    selectTag,
  } = useProjectListContext()
  const {
    handleSelectTag,
    openCreateTagModal,
    handleRenameTag,
    handleDeleteTag,
    CreateTagModal,
    RenameTagModal,
    DeleteTagModal,
  } = useTag()

  return (
    <>
      <li role="separator" className="separator">
        <h2>{t('tags_slash_folders')}</h2>
      </li>
      <li className="tag">
        <Button className="tag-name" onClick={openCreateTagModal}>
          <Icon type="plus" />
          <span className="name">{t('new_folder')}</span>
        </Button>
      </li>
      {sortBy(tags, tag => tag.name?.toLowerCase()).map(tag => {
        return (
          <li
            className={`tag ${selectedTagId === tag._id ? 'active' : ''}`}
            key={tag._id}
          >
            <Button
              className="tag-name"
              onClick={e =>
                handleSelectTag(e as unknown as React.MouseEvent, tag._id)
              }
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
                <span className="subdued">
                  ({projectsPerTag[tag._id].length})
                </span>
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
      <CreateTagModal id="create-tag-modal" />
      <RenameTagModal id="delete-tag-modal" />
      <DeleteTagModal id="rename-tag-modal" />
    </>
  )
}
