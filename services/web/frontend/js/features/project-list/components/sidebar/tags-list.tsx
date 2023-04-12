import { sortBy } from 'lodash'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import MaterialIcon from '../../../../shared/components/material-icon'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import useTag from '../../hooks/use-tag'
import { getTagColor } from '../../util/tag'

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
    handleEditTag,
    handleDeleteTag,
    CreateTagModal,
    EditTagModal,
    DeleteTagModal,
  } = useTag()

  return (
    <>
      <li role="separator" className="separator">
        <h2>{t('organize_projects')}</h2>
      </li>
      <li className="tag">
        <Button
          className="tag-name"
          onClick={openCreateTagModal}
          bsStyle={null}
        >
          <Icon type="plus" />
          <span className="name">{t('new_tag')}</span>
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
              bsStyle={null}
            >
              <span
                style={{
                  color: getTagColor(tag),
                }}
              >
                <MaterialIcon type="label" style={{ verticalAlign: 'sub' }} />
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
                    onClick={e => handleEditTag(e, tag._id)}
                    className="tag-action"
                  >
                    {t('edit')}
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
      {tags.length > 0 && (
        <li
          className={`tag untagged ${
            selectedTagId === UNCATEGORIZED_KEY ? 'active' : ''
          }`}
        >
          <Button
            className="tag-name"
            onClick={() => selectTag(UNCATEGORIZED_KEY)}
            bsStyle={null}
          >
            <span className="name">{t('uncategorized')}</span>
            <span className="subdued"> ({untaggedProjectsCount})</span>
          </Button>
        </li>
      )}
      <CreateTagModal id="create-tag-modal" />
      <EditTagModal id="edit-tag-modal" />
      <DeleteTagModal id="delete-tag-modal" />
    </>
  )
}
