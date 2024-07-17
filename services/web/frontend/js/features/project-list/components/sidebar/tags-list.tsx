import { sortBy } from 'lodash'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '../../../../shared/components/material-icon'
import {
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import useTag from '../../hooks/use-tag'
import { getTagColor } from '../../util/tag'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
        <button type="button" className="tag-name" onClick={openCreateTagModal}>
          <MaterialIcon type="add" className="tag-list-icon" />
          <span className="name">{t('new_tag')}</span>
        </button>
      </li>
      {sortBy(tags, tag => tag.name?.toLowerCase()).map(tag => {
        return (
          <li
            className={`tag ${selectedTagId === tag._id ? 'active' : ''}`}
            key={tag._id}
          >
            <button
              type="button"
              className="tag-name"
              onClick={e =>
                handleSelectTag(e as unknown as React.MouseEvent, tag._id)
              }
            >
              <span
                style={{
                  color: getTagColor(tag),
                }}
              >
                <MaterialIcon type="label" className="tag-list-icon" />
              </span>
              <span className="name">
                {tag.name}{' '}
                <span className="subdued">
                  ({projectsPerTag[tag._id].length})
                </span>
              </span>
            </button>
            <BootstrapVersionSwitcher
              bs5={
                <Dropdown align="end" className="tag-menu">
                  <DropdownToggle id={`${tag._id}-dropdown-toggle`}>
                    <span className="caret" />
                  </DropdownToggle>
                  <DropdownMenu className="sm">
                    <DropdownItem
                      as="li"
                      className="tag-action"
                      onClick={e => handleEditTag(e, tag._id)}
                    >
                      {t('edit')}
                    </DropdownItem>
                    <DropdownItem
                      as="li"
                      className="tag-action"
                      onClick={e => handleDeleteTag(e, tag._id)}
                    >
                      {t('delete')}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              }
              bs3={
                <span className="dropdown tag-menu">
                  <button
                    type="button"
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
                      <button
                        type="button"
                        onClick={e => handleEditTag(e, tag._id)}
                        className="tag-action"
                      >
                        {t('edit')}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={e => handleDeleteTag(e, tag._id)}
                        className="tag-action"
                      >
                        {t('delete')}
                      </button>
                    </li>
                  </ul>
                </span>
              }
            />
          </li>
        )
      })}
      {tags.length > 0 && (
        <li
          className={`tag untagged ${
            selectedTagId === UNCATEGORIZED_KEY ? 'active' : ''
          }`}
        >
          <button
            type="button"
            className="tag-name"
            onClick={() => selectTag(UNCATEGORIZED_KEY)}
          >
            <span className="name">
              {t('uncategorized')}{' '}
              <span className="subdued">({untaggedProjectsCount})</span>
            </span>
          </button>
        </li>
      )}
      <CreateTagModal id="create-tag-modal" />
      <EditTagModal id="edit-tag-modal" />
      <DeleteTagModal id="delete-tag-modal" />
    </>
  )
}
