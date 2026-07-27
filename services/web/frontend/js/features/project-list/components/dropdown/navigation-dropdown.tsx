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
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
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

function NavigationDropdown({ activePage }: { activePage: ActivePage }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() =>
    activePage === 'library' ? t('library') : t('all_projects')
  )
  const [view, setView] = useState<'top' | 'tags'>('top')
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
  }, [filter, tags, selectedTagId, t, activePage])

  const filterItems = (
    <>
      <li role="none">
        <Item
          filter="all"
          text={t('all_projects')}
          activePage={activePage}
          leadingIcon={isLibraryEnabled && <Folder size={20} />}
        />
      </li>
      <li role="none">
        <Item
          filter="owned"
          text={t('your_projects')}
          activePage={activePage}
          leadingIcon={isLibraryEnabled && <OLDropdownItem.EmptyLeadingIcon />}
        />
      </li>
      <li role="none">
        <Item
          filter="shared"
          text={t('shared_with_you')}
          activePage={activePage}
          leadingIcon={isLibraryEnabled && <OLDropdownItem.EmptyLeadingIcon />}
        />
      </li>
      <li role="none">
        <Item
          filter="archived"
          text={t('archived_projects')}
          activePage={activePage}
          leadingIcon={isLibraryEnabled && <OLDropdownItem.EmptyLeadingIcon />}
        />
      </li>
      {!isLibraryEnabled && (
        <li role="none">
          <Item
            filter="trashed"
            text={t('trashed_projects')}
            activePage={activePage}
          />
        </li>
      )}
    </>
  )

  const submenuItems = (
    <>
      {filterItems}
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
              if (show) {
                setView(selectedTagId !== undefined ? 'tags' : 'top')
              } else {
                setView('top')
              }
            }
          : undefined
      }
    >
      <OLDropdownToggle
        id="projects-types-dropdown-toggle-btn"
        className="ps-0 mb-0 btn-transparent h3"
        size="lg"
        aria-label={
          isLibraryEnabled ? t('navigation_menu') : t('filter_projects')
        }
      >
        <span className="text-truncate" aria-hidden>
          {title}
        </span>
      </OLDropdownToggle>
      <OLDropdownMenu
        flip={false}
        className={
          isLibraryEnabled ? 'projects-dropdown-menu-library' : undefined
        }
      >
        {!isLibraryEnabled && submenuItems}
        {isLibraryEnabled && view === 'top' && (
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
              <Item
                filter="trashed"
                text={t('trash')}
                leadingIcon={<Trash size={20} />}
                activePage={activePage}
              />
            </li>
            <li role="none">
              <OLDropdownItem
                active={activePage === 'library'}
                href="/library"
                leadingIcon={<BookBookmark size={20} />}
              >
                {t('library')}
              </OLDropdownItem>
            </li>
          </>
        )}
        {isLibraryEnabled && view === 'tags' && (
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
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default NavigationDropdown
