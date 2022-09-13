import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import {
  Filter,
  useProjectListContext,
} from '../../context/project-list-context'
import TagsList from './tags-list'

type SidebarFilterProps = {
  filter: Filter
  text: ReactNode
}
function SidebarFilter({ filter, text }: SidebarFilterProps) {
  const {
    filter: activeFilter,
    selectFilter,
    selectedTag,
  } = useProjectListContext()

  return (
    <li
      className={
        selectedTag === undefined && filter === activeFilter ? 'active' : ''
      }
    >
      <Button onClick={() => selectFilter(filter)}>{text}</Button>
    </li>
  )
}

export default function SidebarFilters() {
  const { t } = useTranslation()

  return (
    <div className="row-spaced ng-scope">
      <ul className="list-unstyled folders-menu">
        <SidebarFilter filter="all" text={t('all_projects')} />
        <SidebarFilter filter="owned" text={t('your_projects')} />
        <SidebarFilter filter="shared" text={t('shared_with_you')} />
        <SidebarFilter filter="archived" text={t('archived_projects')} />
        <SidebarFilter filter="trashed" text={t('trashed_projects')} />
        <TagsList />
      </ul>
    </div>
  )
}
