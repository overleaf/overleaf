import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import ProjectListTableRow from './project-list-table-row'
import { useProjectListContext } from '../../context/project-list-context'
import { Project, Sort } from '../../../../../../types/project/dashboard/api'
import { SortingOrder } from '../../../../../../types/sorting-order'

type SortByIconTableProps = {
  column: string
  sort: Sort
  text: string
  onClick: () => void
}

function SortByButton({ column, sort, text, onClick }: SortByIconTableProps) {
  const { t } = useTranslation()
  let icon

  let screenReaderText = t('sort_by_x', { x: text })

  if (column === sort.by) {
    const iconType = sort.order === 'asc' ? 'caret-up' : 'caret-down'
    icon = <Icon className="tablesort" type={iconType} />
    screenReaderText = t('reverse_x_sort_order', { x: text })
  }

  return (
    <button className="btn-link table-header-sort-btn" onClick={onClick}>
      {text}
      {icon}
      <span className="sr-only">{screenReaderText}</span>
    </button>
  )
}

const toggleSort = (order: SortingOrder): SortingOrder => {
  return order === 'asc' ? 'desc' : 'asc'
}

function ProjectListTable() {
  const { t } = useTranslation()
  const {
    visibleProjects,
    sort,
    setSort,
    selectedProjects,
    setSelectedProjects,
  } = useProjectListContext()

  const handleSortClick = (by: Sort['by']) => {
    setSort(prev => ({
      by,
      order: prev.by === by ? toggleSort(sort.order) : sort.order,
    }))
  }

  const handleAllProjectsCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        setSelectedProjects(visibleProjects)
      } else {
        setSelectedProjects([])
      }
    },
    [setSelectedProjects, visibleProjects]
  )

  return (
    <div className="card project-list-card">
      <table className="project-dash-table">
        <thead>
          <tr>
            <th
              className="dash-cell-checkbox"
              aria-label={t('select_projects')}
            >
              <input
                type="checkbox"
                id="project-list-table-select-all"
                onChange={handleAllProjectsCheckboxChange}
                checked={
                  visibleProjects.length === selectedProjects.length &&
                  visibleProjects.length !== 0
                }
                disabled={visibleProjects.length === 0}
              />
              <label
                htmlFor="project-list-table-select-all"
                aria-label={t('select_all_projects')}
                className="sr-only"
              />
            </th>
            <th
              className="dash-cell-name"
              aria-label={t('title')}
              aria-sort={
                sort.by === 'title'
                  ? sort.order === 'asc'
                    ? t('ascending')
                    : t('descending')
                  : undefined
              }
            >
              <SortByButton
                column="title"
                text={t('title')}
                sort={sort}
                onClick={() => handleSortClick('title')}
              />
            </th>
            <th
              className="dash-cell-owner"
              aria-label={t('owner')}
              aria-sort={
                sort.by === 'owner'
                  ? sort.order === 'asc'
                    ? t('ascending')
                    : t('descending')
                  : undefined
              }
            >
              <SortByButton
                column="owner"
                text={t('owner')}
                sort={sort}
                onClick={() => handleSortClick('owner')}
              />
            </th>
            <th
              className="dash-cell-date"
              aria-label={t('last_modified')}
              aria-sort={
                sort.by === 'lastUpdated'
                  ? sort.order === 'asc'
                    ? t('ascending')
                    : t('descending')
                  : undefined
              }
            >
              <SortByButton
                column="lastUpdated"
                text={t('last_modified')}
                sort={sort}
                onClick={() => handleSortClick('lastUpdated')}
              />
            </th>
            <th className="dash-cell-actions">{t('actions')}</th>
          </tr>
        </thead>

        <tbody>
          {visibleProjects.length ? (
            visibleProjects.map((p: Project) => (
              <ProjectListTableRow project={p} key={p.id} />
            ))
          ) : (
            <tr className="no-projects">
              <td className="project-list-table-no-projects-cell" colSpan={5}>
                {t('no_projects')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default ProjectListTable
