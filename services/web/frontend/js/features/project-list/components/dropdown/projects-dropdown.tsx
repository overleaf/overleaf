import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown, MenuItem } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import {
  Filter,
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import ProjectsFilterMenu from '../projects-filter-menu'
import TagsList from '../tags-list'
import MenuItemButton from './menu-item-button'

type ItemProps = {
  filter: Filter
  text: string
  onClick: () => void
}

export function Item({ filter, text, onClick }: ItemProps) {
  const { selectFilter } = useProjectListContext()
  const handleClick = () => {
    selectFilter(filter)
    onClick()
  }

  return (
    <ProjectsFilterMenu filter={filter}>
      {isActive => (
        <MenuItemButton
          onClick={handleClick}
          className="projects-types-menu-item"
        >
          {isActive ? (
            <Icon type="check" className="menu-item-button-icon" />
          ) : null}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </ProjectsFilterMenu>
  )
}

function ProjectsDropdown() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => t('all_projects'))
  const [isOpened, setIsOpened] = useState(false)
  const { filter, selectedTagId, tags } = useProjectListContext()
  const filterTranslations = useRef<Record<Filter, string>>({
    all: t('all_projects'),
    owned: t('your_projects'),
    shared: t('shared_with_you'),
    archived: t('archived_projects'),
    trashed: t('trashed_projects'),
  })
  const handleClose = () => setIsOpened(false)

  useEffect(() => {
    if (selectedTagId === undefined) {
      setTitle(filterTranslations.current[filter])
    }

    if (selectedTagId === UNCATEGORIZED_KEY) {
      setTitle(t('uncategorized'))
    } else {
      const tag = tags.find(({ _id: id }) => id === selectedTagId)

      if (tag) {
        setTitle(tag.name ?? '')
      }
    }
  }, [filter, tags, selectedTagId, t])

  return (
    <Dropdown
      id="projects-types-dropdown"
      open={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <Dropdown.Toggle bsSize="large" noCaret className="ps-0 btn-transparent">
        <span className="text-truncate me-1">{title}</span>
        <Icon type="angle-down" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="projects-dropdown-menu">
        <Item filter="all" text={t('all_projects')} onClick={handleClose} />
        <Item filter="owned" text={t('your_projects')} onClick={handleClose} />
        <Item
          filter="shared"
          text={t('shared_with_you')}
          onClick={handleClose}
        />
        <Item
          filter="archived"
          text={t('archived_projects')}
          onClick={handleClose}
        />
        <Item
          filter="trashed"
          text={t('trashed_projects')}
          onClick={handleClose}
        />
        <MenuItem header>{t('tags')}:</MenuItem>
        <TagsList onTagClick={handleClose} onEditClick={handleClose} />
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default ProjectsDropdown
