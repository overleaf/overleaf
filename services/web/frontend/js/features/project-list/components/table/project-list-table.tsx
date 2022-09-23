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
    <button className="btn-link table-header-sort-btn" onClick={onClick}>
      {text}
      {iconType ? <Icon className="tablesort" type={iconType} /> : null}
      <span className="sr-only">{screenReaderText}</span>
    </button>
  )
}

const SortByButton = withContent(SortBtn)

function ProjectListTable() {
  const { t } = useTranslation()
  const { visibleProjects, sort, selectedProjects, setSelectedProjects } =
    useProjectListContext()
  const { handleSort } = useSort()

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
    <table className="project-dash-table">
      <thead className="hidden-xs">
        <tr>
          <th className="dash-cell-checkbox" aria-label={t('select_projects')}>
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
              onClick={() => handleSort('title')}
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
              onClick={() => handleSort('owner')}
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
              onClick={() => handleSort('lastUpdated')}
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
  )
}

export default ProjectListTable
