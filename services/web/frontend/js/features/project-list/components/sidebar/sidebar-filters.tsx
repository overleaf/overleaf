import { useTranslation } from 'react-i18next'
import {
  Filter,
  useProjectListContext,
} from '../../context/project-list-context'
import TagsList from './tags-list'
import ProjectsFilterMenu from '../projects-filter-menu'
import { useSplitTestContext } from '@/shared/context/split-test-context'

type SidebarFilterProps = {
  filter: Filter
  text: React.ReactNode
}

export function SidebarFilter({ filter, text }: SidebarFilterProps) {
  const { selectFilter } = useProjectListContext()

  return (
    <ProjectsFilterMenu filter={filter}>
      {isActive => (
        <li className={isActive ? 'active' : ''}>
          <button type="button" onClick={() => selectFilter(filter)}>
            {text}
          </button>
        </li>
      )}
    </ProjectsFilterMenu>
  )
}

export default function SidebarFilters() {
  const { t } = useTranslation()
  const { splitTestVariants } = useSplitTestContext()
  const hasDsNav =
    splitTestVariants['sidebar-navigation-ui-update'] === 'active'

  return (
    <ul className="list-unstyled project-list-filters">
      <SidebarFilter filter="all" text={t('all_projects')} />
      <SidebarFilter filter="owned" text={t('your_projects')} />
      <SidebarFilter filter="shared" text={t('shared_with_you')} />
      <SidebarFilter filter="archived" text={t('archived_projects')} />
      <SidebarFilter filter="trashed" text={t('trashed_projects')} />
      {hasDsNav && (
        <li role="none">
          <hr />
        </li>
      )}
      <TagsList />
    </ul>
  )
}
