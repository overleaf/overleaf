import {
  ProjectListProvider,
  useProjectListContext,
} from '../context/project-list-context'
import { ColorPickerProvider } from '../context/color-picker-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import SurveyWidget from './survey-widget'
import WelcomeMessage from './welcome-message'
import LoadingBranded from '../../../shared/components/loading-branded'
import SystemMessages from '../../../shared/components/system-messages'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'
import ProjectsDropdown from './dropdown/projects-dropdown'
import SortByDropdown from './dropdown/sort-by-dropdown'
import ProjectTools from './table/project-tools/project-tools'
import ProjectListTitle from './title/project-list-title'
import Sidebar from './sidebar/sidebar'
import LoadMore from './load-more'
import { useEffect } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { GenericErrorBoundaryFallback } from '../../../shared/components/generic-error-boundary-fallback'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import OLCol from '@/features/ui/components/ol/ol-col'
import Notification from '@/shared/components/notification'
import OLRow from '@/features/ui/components/ol/ol-row'
import { TableContainer } from '@/features/ui/components/bootstrap-5/table'

function ProjectListRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <ProjectListRootInner />
}

export function ProjectListRootInner() {
  return (
    <ProjectListProvider>
      <ColorPickerProvider>
        <SplitTestProvider>
          <ProjectListPageContent />
        </SplitTestProvider>
      </ColorPickerProvider>
    </ProjectListProvider>
  )
}

function ProjectListPageContent() {
  const {
    totalProjectsCount,
    error,
    isLoading,
    loadProgress,
    searchText,
    setSearchText,
    selectedProjects,
    filter,
    tags,
    selectedTagId,
  } = useProjectListContext()

  const selectedTag = tags.find(tag => tag._id === selectedTagId)

  useEffect(() => {
    eventTracking.sendMB('loads_v2_dash', {})
  }, [])

  const { t } = useTranslation()

  const tableTopArea = (
    <div className="pt-2 pb-3 d-md-none">
      <div className="clearfix">
        <NewProjectButton
          id="new-project-button-projects-table"
          className="pull-left me-2"
          showAddAffiliationWidget
        />
        <SearchForm
          inputValue={searchText}
          setInputValue={setSearchText}
          filter={filter}
          selectedTag={selectedTag}
          className="overflow-hidden"
        />
      </div>
    </div>
  )

  return isLoading ? (
    <div className="loading-container">
      <LoadingBranded loadProgress={loadProgress} label={t('loading')} />
    </div>
  ) : (
    <>
      <SystemMessages />

      <div className="project-list-wrapper">
        {totalProjectsCount > 0 ? (
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
        ) : (
          <div className="project-list-welcome-wrapper">
            {error ? <DashApiError /> : ''}
            <OLRow className="row-spaced mx-0">
              <OLCol
                md={{ span: 10, offset: 1 }}
                lg={{ span: 8, offset: 2 }}
                className="project-list-empty-col"
              >
                <OLRow>
                  <OLCol>
                    <UserNotifications />
                  </OLCol>
                </OLRow>
                <WelcomeMessage />
              </OLCol>
            </OLRow>
          </div>
        )}
      </div>
    </>
  )
}

function DashApiError() {
  const { t } = useTranslation()
  return (
    <OLRow className="row-spaced">
      <OLCol xs={{ span: 8, offset: 2 }} aria-live="polite">
        <div className="notification-list">
          <Notification
            content={t('generic_something_went_wrong')}
            type="error"
          />
        </div>
      </OLCol>
    </OLRow>
  )
}

export default withErrorBoundary(ProjectListRoot, GenericErrorBoundaryFallback)
