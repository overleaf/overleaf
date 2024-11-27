import { useProjectListContext } from '../context/project-list-context'
import { useTranslation } from 'react-i18next'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import SurveyWidget from './survey-widget'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'
import ProjectsDropdown from './dropdown/projects-dropdown'
import SortByDropdown from './dropdown/sort-by-dropdown'
import ProjectTools from './table/project-tools/project-tools'
import ProjectListTitle from './title/project-list-title'
import Sidebar from './sidebar/sidebar'
import LoadMore from './load-more'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLRow from '@/features/ui/components/ol/ol-row'
import { TableContainer } from '@/features/ui/components/bootstrap-5/table'
import DashApiError from '@/features/project-list/components/dash-api-error'

export default function ProjectListDefault() {
  const { t } = useTranslation()
  const {
    error,
    searchText,
    setSearchText,
    selectedProjects,
    filter,
    tags,
    selectedTagId,
  } = useProjectListContext()

  const selectedTag = tags.find(tag => tag._id === selectedTagId)

  const tableTopArea = (
    <div className="pt-2 pb-3 d-md-none d-flex gap-2">
      <NewProjectButton
        id="new-project-button-projects-table"
        showAddAffiliationWidget
      />
      <SearchForm
        inputValue={searchText}
        setInputValue={setSearchText}
        filter={filter}
        selectedTag={selectedTag}
        className="overflow-hidden flex-grow-1"
      />
    </div>
  )

  return (
    <>
      <Sidebar />
      <div className="project-list-main-react">
        {error ? <DashApiError /> : ''}
        <OLRow>
          <OLCol>
            <UserNotifications />
          </OLCol>
        </OLRow>
        <div className="project-list-header-row">
          <ProjectListTitle
            filter={filter}
            selectedTag={selectedTag}
            selectedTagId={selectedTagId}
            className="text-truncate d-none d-md-block"
          />
          <div className="project-tools">
            <div className="d-none d-md-block">
              {selectedProjects.length === 0 ? (
                <CurrentPlanWidget />
              ) : (
                <ProjectTools />
              )}
            </div>
            <div className="d-md-none">
              <CurrentPlanWidget />
            </div>
          </div>
        </div>
        <OLRow className="d-none d-md-block">
          <OLCol lg={7}>
            <SearchForm
              inputValue={searchText}
              setInputValue={setSearchText}
              filter={filter}
              selectedTag={selectedTag}
            />
          </OLCol>
        </OLRow>
        <div className="project-list-sidebar-survey-wrapper d-md-none">
          <SurveyWidget />
        </div>
        <div className="mt-1 d-md-none">
          <div
            role="toolbar"
            className="projects-toolbar"
            aria-label={t('projects')}
          >
            <ProjectsDropdown />
            <SortByDropdown />
          </div>
        </div>
        <OLRow className="row-spaced">
          <OLCol>
            <TableContainer bordered>
              {tableTopArea}
              <ProjectListTable />
            </TableContainer>
          </OLCol>
        </OLRow>
        <OLRow className="row-spaced">
          <OLCol>
            <LoadMore />
          </OLCol>
        </OLRow>
      </div>
    </>
  )
}
