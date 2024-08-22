import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown as BS3Dropdown,
  MenuItem as BS3MenuItem,
} from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import {
  Filter,
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import ProjectsFilterMenu from '../projects-filter-menu'
import TagsList from '../tags-list'
import MenuItemButton from './menu-item-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type ItemProps = {
  filter: Filter
  text: string
  onClick?: () => void
}

export function Item({ filter, text, onClick }: ItemProps) {
  const { selectFilter } = useProjectListContext()
  const handleClick = () => {
    selectFilter(filter)
    onClick?.()
  }

  return (
    <ProjectsFilterMenu filter={filter}>
      {isActive => (
        <BootstrapVersionSwitcher
          bs3={
            <MenuItemButton
              onClick={handleClick}
              className="projects-types-menu-item"
            >
              {isActive ? (
                <Icon type="check" className="menu-item-button-icon" />
              ) : null}
              <span className="menu-item-button-text">{text}</span>
            </MenuItemButton>
          }
          bs5={
            <DropdownItem
              as="button"
              tabIndex={-1}
              onClick={handleClick}
              trailingIcon={isActive ? 'check' : undefined}
              active={isActive}
            >
              {text}
            </DropdownItem>
          }
        />
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
      setTitle(t('uncategorized_projects'))
    } else {
      const tag = tags.find(({ _id: id }) => id === selectedTagId)

      if (tag) {
        setTitle(tag.name ?? '')
      }
    }
  }, [filter, tags, selectedTagId, t])

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Dropdown
          id="projects-types-dropdown"
          open={isOpened}
          onToggle={open => setIsOpened(open)}
        >
          <BS3Dropdown.Toggle
            bsSize="large"
            noCaret
            className="ps-0 btn-transparent"
          >
            <span className="text-truncate me-1">{title}</span>
            <Icon type="angle-down" />
          </BS3Dropdown.Toggle>
          <BS3Dropdown.Menu className="projects-dropdown-menu">
            <Item filter="all" text={t('all_projects')} onClick={handleClose} />
            <Item
              filter="owned"
              text={t('your_projects')}
              onClick={handleClose}
            />
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
            <BS3MenuItem header>{t('tags')}:</BS3MenuItem>
            <TagsList onTagClick={handleClose} onEditClick={handleClose} />
          </BS3Dropdown.Menu>
        </BS3Dropdown>
      }
      bs5={
        <Dropdown>
          <DropdownToggle
            id="projects-types-dropdown-toggle-btn"
            className="ps-0 mb-0 btn-transparent h3"
            size="lg"
            aria-label={t('filter_projects')}
          >
            <span className="text-truncate" aria-hidden>
              {title}
            </span>
          </DropdownToggle>
          <DropdownMenu flip={false}>
            <li role="none">
              <Item filter="all" text={t('all_projects')} />
            </li>
            <li role="none">
              <Item filter="owned" text={t('your_projects')} />
            </li>
            <li role="none">
              <Item filter="shared" text={t('shared_with_you')} />
            </li>
            <li role="none">
              <Item filter="archived" text={t('archived_projects')} />
            </li>
            <li role="none">
              <Item filter="trashed" text={t('trashed_projects')} />
            </li>
            <DropdownHeader className="text-uppercase">
              {t('tags')}:
            </DropdownHeader>
            <TagsList />
          </DropdownMenu>
        </Dropdown>
      }
    />
  )
}

export default ProjectsDropdown
