import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash } from '@phosphor-icons/react'
import {
  Filter,
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import {
  OLDropdown,
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import ProjectsFilterMenu from '../projects-filter-menu'
import TagsList from '../tags-list'
import MobilePageSwitcherItems from './mobile-page-switcher-items'

type ItemProps = {
  filter: Filter
  text: string
  leadingIcon?: React.ReactNode
  onClick?: () => void
}

export function Item({ filter, text, leadingIcon, onClick }: ItemProps) {
  const { selectFilter } = useProjectListContext()
  const handleClick = () => {
    selectFilter(filter)
    onClick?.()
  }

  return (
    <ProjectsFilterMenu filter={filter}>
      {isActive => (
        <OLDropdownItem
          as="button"
          tabIndex={-1}
          onClick={handleClick}
          leadingIcon={leadingIcon}
          trailingIcon={isActive ? 'check' : undefined}
          active={isActive}
        >
          {text}
        </OLDropdownItem>
      )}
    </ProjectsFilterMenu>
  )
}

function ProjectsDropdown() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => t('all_projects'))
  const [view, setView] = useState<'top' | 'submenu'>('submenu')
  const { filter, selectedTagId, tags } = useProjectListContext()
  const isLibraryEnabled = isSplitTestEnabled('overleaf-library')
  const filterTranslations = useRef<Record<Filter, string>>({
    all: t('all_projects'),
    owned: t('your_projects'),
    shared: t('shared_with_you'),
    archived: t('archived_projects'),
    trashed: t('trashed_projects'),
  })

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

  const submenuItems = (
    <>
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
      {!isLibraryEnabled && (
        <li role="none">
          <Item filter="trashed" text={t('trashed_projects')} />
        </li>
      )}
      <OLDropdownHeader className="text-uppercase">
        {t('tags')}:
      </OLDropdownHeader>
      <TagsList />
    </>
  )

  return (
    <OLDropdown
      onToggle={
        isLibraryEnabled
          ? show => {
              if (!show) {
                setView('submenu')
              }
            }
          : undefined
      }
    >
      <OLDropdownToggle
        id="projects-types-dropdown-toggle-btn"
        className="ps-0 mb-0 btn-transparent h3"
        size="lg"
        aria-label={t('filter_projects')}
      >
        <span className="text-truncate" aria-hidden>
          {title}
        </span>
      </OLDropdownToggle>
      <OLDropdownMenu flip={false}>
        {!isLibraryEnabled && submenuItems}
        {isLibraryEnabled && view === 'submenu' && (
          <>
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                leadingIcon={<MaterialIcon type="chevron_left" />}
                aria-label={t('back')}
                onClick={e => {
                  e.stopPropagation()
                  setView('top')
                }}
              >
                {t('projects')}
              </OLDropdownItem>
            </li>
            {submenuItems}
            <li role="none">
              <Item
                filter="trashed"
                text={t('trash')}
                leadingIcon={<Trash size={20} />}
              />
            </li>
          </>
        )}
        {isLibraryEnabled && view === 'top' && (
          <MobilePageSwitcherItems
            activePage="projects"
            onProjectsClick={() => setView('submenu')}
          />
        )}
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default ProjectsDropdown
