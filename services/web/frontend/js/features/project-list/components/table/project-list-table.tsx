import { useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectListTableRow from './project-list-table-row'
import { useProjectListContext } from '../../context/project-list-context'
import useSort from '../../hooks/use-sort'
import withContent, { SortBtnProps } from '../sort/with-content'
import OLTable from '@/shared/components/ol/ol-table'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import MaterialIcon from '@/shared/components/material-icon'

function SortBtn({ onClick, text, iconType, screenReaderText }: SortBtnProps) {
  return (
    <button
      className="table-header-sort-btn d-none d-md-inline-block"
      onClick={onClick}
      aria-label={screenReaderText}
    >
      <span>{text}</span>
      {iconType && <MaterialIcon type={iconType} />}
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
  const checkAllRef = useRef<HTMLInputElement>(null)

  const handleAllProjectsCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      selectOrUnselectAllProjects(event.target.checked)
    },
    [selectOrUnselectAllProjects]
  )

  useEffect(() => {
    if (checkAllRef.current) {
      checkAllRef.current.indeterminate =
        selectedProjects.length > 0 &&
        selectedProjects.length !== visibleProjects.length
    }
  }, [selectedProjects, visibleProjects])

  return (
    <OLTable className="project-dash-table" container={false} hover>
      <caption className="visually-hidden">{t('projects_list')}</caption>
      <thead className="visually-hidden-max-md">
        <tr>
          <th
            className="dash-cell-checkbox d-none d-md-table-cell"
            aria-label={t('select_projects')}
          >
            <OLFormCheckbox
              autoComplete="off"
              onChange={handleAllProjectsCheckboxChange}
              checked={
                visibleProjects.length === selectedProjects.length &&
                visibleProjects.length !== 0
              }
              disabled={visibleProjects.length === 0}
              aria-label={t('select_all_projects')}
              inputRef={checkAllRef}
            />
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
            className="dash-cell-date-owner d-md-none"
            aria-label={t('date_and_owner')}
          >
            {t('date_and_owner')}
          </th>
          <th
            className="dash-cell-owner d-none d-md-table-cell"
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
            className="dash-cell-date d-none d-md-table-cell"
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
          <th className="dash-cell-tag d-md-none" aria-label={t('tags')}>
            {t('tags')}
          </th>
          <th className="dash-cell-actions" aria-label={t('actions')}>
            {t('actions')}
          </th>
        </tr>
      </thead>
      <tbody>
        {visibleProjects.length > 0 ? (
          visibleProjects.map(p => (
            <ProjectListTableRow
              project={p}
              selected={selectedProjects.some(({ id }) => id === p.id)}
              key={p.id}
            />
          ))
        ) : (
          <tr className="no-projects">
            <td className="text-center" colSpan={5}>
              {t('no_projects')}
            </td>
          </tr>
        )}
      </tbody>
    </OLTable>
  )
}

export default ProjectListTable
