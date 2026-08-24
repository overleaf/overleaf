import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BookBookmark, Trash, Folder } from '@phosphor-icons/react'
import {
  Filter,
  UNCATEGORIZED_KEY,
  useProjectListContext,
} from '../../context/project-list-context'
import {
  OLDropdown,
  OLDropdownDivider,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import ProjectsFilterMenu from '../projects-filter-menu'
import TagsList from '../tags-list'
import { ActivePage } from '../../util/navigation-state'

type ItemProps = {
  filter: Filter
  text: string
  activePage: ActivePage
  leadingIcon?: React.ReactNode
  onClick?: () => void
}

export function Item({
  filter,
  text,
  leadingIcon,
  onClick,
  activePage,
}: ItemProps) {
  const { selectFilter } = useProjectListContext()
  const handleClick = () => {
    selectFilter(filter)
    onClick?.()
  }

  return (
    <ProjectsFilterMenu filter={filter} activePage={activePage}>
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

function NavigationDropdown({
  activePage,
  trashActive = false,
}: {
  activePage: ActivePage

  /**
   * Whether the trash is active. This is only relevant when the active page is
   * "library" as which project page is active is determined by the selected
   * filter.
   */
  trashActive?: boolean
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() =>
    activePage === 'library' ? t('library') : t('all_projects')
  )
  const [view, setView] = useState<'top' | 'tags' | 'trash'>('top')
  const { filter, selectedTagId, tags } = useProjectListContext()
  const projectsTrashActive =
    activePage === 'projects' &&
    selectedTagId === undefined &&
    filter === 'trashed'
  const referencesTrashActive = activePage === 'library' && trashActive
  const isTrashActive = projectsTrashActive || referencesTrashActive
  const filterTranslations = useRef<Record<Filter, string>>({
    all: t('all_projects'),
    owned: t('your_projects'),
    shared: t('shared_with_you'),
    archived: t('archived_projects'),
    trashed: t('trashed_projects'),
  })

  useEffect(() => {
    if (isTrashActive) {
      setTitle(t('trash'))
      return
    }

    if (activePage === 'library') {
      setTitle(t('library'))
      return
    }

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
  }, [filter, tags, selectedTagId, t, activePage, isTrashActive])

  const filterItems = (
    <>
      <li role="none">
        <Item
          filter="all"
          text={t('all_projects')}
          activePage={activePage}
          leadingIcon={<Folder size={20} />}
        />
      </li>
      <li role="none">
        <Item
          filter="owned"
          text={t('your_projects')}
          activePage={activePage}
          leadingIcon={<OLDropdownItem.EmptyLeadingIcon />}
        />
      </li>
      <li role="none">
        <Item
          filter="shared"
          text={t('shared_with_you')}
          activePage={activePage}
          leadingIcon={<OLDropdownItem.EmptyLeadingIcon />}
        />
      </li>
      <li role="none">
        <Item
          filter="archived"
          text={t('archived_projects')}
          activePage={activePage}
          leadingIcon={<OLDropdownItem.EmptyLeadingIcon />}
        />
      </li>
    </>
  )

  return (
    <OLDropdown
      onToggle={show => {
        if (show) {
          if (selectedTagId !== undefined) {
            setView('tags')
          } else if (isTrashActive) {
            setView('trash')
          } else {
            setView('top')
          }
        } else {
          setView('top')
        }
      }}
    >
      <OLDropdownToggle
        id="projects-types-dropdown-toggle-btn"
        className="ps-0 mb-0 btn-transparent h3"
        size="lg"
        aria-label={t('navigation_menu')}
      >
        <span className="text-truncate" aria-hidden>
          {title}
        </span>
      </OLDropdownToggle>
      <OLDropdownMenu flip={false} className="projects-dropdown-menu-library">
        {view === 'top' && (
          <>
            {filterItems}
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                trailingIcon="chevron_right"
                leadingIcon={<OLDropdownItem.EmptyLeadingIcon />}
                onClick={e => {
                  e.stopPropagation()
                  setView('tags')
                }}
              >
                {t('tags')}
              </OLDropdownItem>
            </li>
            <OLDropdownDivider />
            <li role="none">
              <OLDropdownItem
                active={activePage === 'library' && !trashActive}
                href="/library"
                leadingIcon={<BookBookmark size={20} />}
              >
                {t('library')}
              </OLDropdownItem>
            </li>
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                trailingIcon="chevron_right"
                leadingIcon={<Trash size={20} />}
                onClick={e => {
                  e.stopPropagation()
                  setView('trash')
                }}
              >
                {t('trash')}
              </OLDropdownItem>
            </li>
          </>
        )}
        {view === 'tags' && (
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
                {t('tags')}
              </OLDropdownItem>
            </li>
            <TagsList />
          </>
        )}
        {view === 'trash' && (
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
                {t('trash')}
              </OLDropdownItem>
            </li>
            <li role="none">
              <OLDropdownItem
                href="/project/trashed"
                active={projectsTrashActive}
                trailingIcon={projectsTrashActive ? 'check' : undefined}
                leadingIcon={<Folder size={20} />}
              >
                {t('projects')}
              </OLDropdownItem>
            </li>
            <li role="none">
              <OLDropdownItem
                href="/library/trashed"
                active={referencesTrashActive}
                trailingIcon={referencesTrashActive ? 'check' : undefined}
                leadingIcon={<BookBookmark size={20} />}
              >
                {t('references')}
              </OLDropdownItem>
            </li>
          </>
        )}
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default NavigationDropdown
