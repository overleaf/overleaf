import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import ProjectListTableRow from './project-list-table-row'
import { useProjectListContext } from '../../context/project-list-context'
import useSort from '../../hooks/use-sort'
import withContent, { SortBtnProps } from '../sort/with-content'
import { Project } from '../../../../../../types/project/dashboard/api'

function SortBtn({ onClick, text, iconType, screenReaderText }: SortBtnProps) {
  return (
    <button
      className="btn-link table-header-sort-btn hidden-xs"
      onClick={onClick}
      aria-label={screenReaderText}
    >
      <span className="tablesort-text">{text}</span>
      {iconType && <Icon type={iconType} />}
    </button>
  )
}

const SortByButton = withContent(SortBtn)

function ProjectListTable() {
  const { t } = useTranslation()
  const {
    visibleProjects,
    sort,
    selectedProjects,
    selectOrUnselectAllProjects,
  } = useProjectListContext()
  const { handleSort } = useSort()

  const handleAllProjectsCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      selectOrUnselectAllProjects(event.target.checked)
    },
    [selectOrUnselectAllProjects]
  )

  return (
    <table className="project-dash-table">
      <caption className="sr-only">{t('projects_list')}</caption>
      <thead className="sr-only-xs">
        <tr>
          <th
            className="dash-cell-checkbox hidden-xs"
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
            <label htmlFor="project-list-table-select-all" className="sr-only">
              {t('select_all_projects')}
            </label>
          </th>
          <th
            className="dash-cell-name"
            aria-label={t('title')}
            aria-sort={
              sort.by === 'title'
                ? sort.order === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            }
          >
            <SortByButton
              column="title"
              text={t('title')}
              sort={sort}
              onClick={() => handleSort('title')}
            />
          </th>
          <th
            className="dash-cell-date-owner visible-xs"
            aria-label={t('date_and_owner')}
          >
            {t('date_and_owner')}
          </th>
          <th
            className="dash-cell-owner hidden-xs"
            aria-label={t('owner')}
            aria-sort={
              sort.by === 'owner'
                ? sort.order === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            }
          >
            <SortByButton
              column="owner"
              text={t('owner')}
              sort={sort}
              onClick={() => handleSort('owner')}
            />
          </th>
          <th
            className="dash-cell-date hidden-xs"
            aria-label={t('last_modified')}
            aria-sort={
              sort.by === 'lastUpdated'
                ? sort.order === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            }
          >
            <SortByButton
              column="lastUpdated"
              text={t('last_modified')}
              sort={sort}
              onClick={() => handleSort('lastUpdated')}
            />
          </th>
          <th className="dash-cell-tag visible-xs" aria-label={t('tags')}>
            {t('tags')}
          </th>
          <th className="dash-cell-actions" aria-label={t('actions')}>
            {t('actions')}
          </th>
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
  )
}

export default ProjectListTable
