import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import {
  Filter,
  useProjectListContext,
} from '../../context/project-list-context'
import TagsList from './tags-list'
import ProjectsFilterMenu from '../projects-filter-menu'
import { Folder } from '@phosphor-icons/react'
import { ActivePage } from '../../util/navigation-state'

type SidebarFilterProps = {
  filter: Filter
  text: React.ReactNode
  activePage: ActivePage
  icon?: React.ReactNode
}

export function SidebarFilter({
  filter,
  text,
  icon,
  activePage,
}: SidebarFilterProps) {
  const { selectFilter } = useProjectListContext()

  return (
    <ProjectsFilterMenu filter={filter} activePage={activePage}>
      {isActive => (
        <li className={isActive ? 'active' : ''}>
          <button
            className={classNames('sidebar-filter-button', {
              'sidebar-filter-button-with-icon': !!icon,
            })}
            type="button"
            onClick={() => selectFilter(filter)}
          >
            {icon && <span className="icon">{icon}</span>}
            {text}
          </button>
        </li>
      )}
    </ProjectsFilterMenu>
  )
}

export default function SidebarFilters({
  activePage,
}: {
  activePage: ActivePage
}) {
  const { t } = useTranslation()
  return (
    <ul className="list-unstyled project-list-filters">
      <SidebarFilter
        activePage={activePage}
        filter="all"
        text={t('projects')}
        icon={<Folder size={20} />}
      />
      <SidebarFilter
        activePage={activePage}
        filter="owned"
        text={t('your_projects')}
      />
      <SidebarFilter
        activePage={activePage}
        filter="shared"
        text={t('shared_with_you')}
      />
      <SidebarFilter
        activePage={activePage}
        filter="archived"
        text={t('archived_projects')}
      />
      <li aria-hidden="true">
        <hr />
      </li>
      <TagsList />
    </ul>
  )
}
