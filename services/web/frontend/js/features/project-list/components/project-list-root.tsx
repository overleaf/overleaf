import {
  ProjectListProvider,
  useProjectListContext,
} from '../context/project-list-context'
import { ColorPickerProvider } from '../context/color-picker-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import SurveyWidget from './survey-widget'
import WelcomeMessage from './welcome-message'
import LoadingBranded from '../../../shared/components/loading-branded'
import SystemMessages from './notifications/system-messages'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'
import ProjectsDropdown from './dropdown/projects-dropdown'
import SortByDropdown from './dropdown/sort-by-dropdown'
import ProjectTools from './table/project-tools/project-tools'
import ProjectListTitle from './title/project-list-title'
import Sidebar from './sidebar/sidebar'
import LoadMore from './load-more'
import { useEffect } from 'react'
import getMeta from '../../../utils/meta'
import WelcomeMessageNew from './welcome-message-new'

function ProjectListRoot() {
  const { isReady } = useWaitForI18n()

  return isReady ? (
    <ProjectListProvider>
      <ColorPickerProvider>
        <ProjectListPageContent />
      </ColorPickerProvider>
    </ProjectListProvider>
  ) : null
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
  const welcomePageRedesignVariant = getMeta(
    'ol-welcomePageRedesignVariant'
  ) as 'enabled' | 'default'

  useEffect(() => {
    eventTracking.sendMB('loads_v2_dash', {})
  }, [])

  return isLoading ? (
    <div className="loading-container">
      <LoadingBranded loadProgress={loadProgress} />
    </div>
  ) : (
    <>
      <SystemMessages />
      <div className="project-list-wrapper clearfix">
        {totalProjectsCount > 0 ? (
          <>
            <Sidebar />
            <div className="project-list-main-react">
              {error ? <DashApiError /> : ''}
              <Row>
                <Col xs={12}>
                  <UserNotifications />
                </Col>
              </Row>
              <div className="project-list-header-row">
                <ProjectListTitle
                  filter={filter}
                  selectedTag={selectedTag}
                  className="hidden-xs text-truncate"
                />
                <div className="project-tools">
                  <div className="hidden-xs">
                    {selectedProjects.length === 0 ? (
                      <CurrentPlanWidget />
                    ) : (
                      <ProjectTools />
                    )}
                  </div>
                  <div className="visible-xs">
                    <CurrentPlanWidget />
                  </div>
                </div>
              </div>
              <Row className="hidden-xs">
                <Col md={7}>
                  <SearchForm
                    inputValue={searchText}
                    setInputValue={setSearchText}
                    filter={filter}
                    selectedTag={selectedTag}
                  />
                </Col>
              </Row>
              <div className="project-list-sidebar-survey-wrapper visible-xs">
                <SurveyWidget />
              </div>
              <div className="visible-xs mt-1">
                <div role="toolbar" className="projects-toolbar">
                  <ProjectsDropdown />
                  <SortByDropdown />
                </div>
              </div>
              <Row className="row-spaced">
                <Col xs={12}>
                  <div className="card project-list-card">
                    <div className="visible-xs pt-2 pb-3">
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
                          formGroupProps={{ className: 'mb-0' }}
                        />
                      </div>
                    </div>
                    <ProjectListTable />
                  </div>
                </Col>
              </Row>
              <Row className="row-spaced">
                <Col xs={12}>
                  <LoadMore />
                </Col>
              </Row>
            </div>
          </>
        ) : (
          <div className="project-list-welcome-wrapper">
            {error ? <DashApiError /> : ''}
            <Row className="row-spaced">
              <Col
                sm={10}
                smOffset={1}
                md={8}
                mdOffset={2}
                className="project-list-empty-col"
              >
                <Row>
                  <Col xs={12}>
                    <UserNotifications />
                  </Col>
                </Row>
                {welcomePageRedesignVariant === 'enabled' ? (
                  <WelcomeMessageNew />
                ) : (
                  <WelcomeMessage />
                )}
              </Col>
            </Row>
          </div>
        )}
      </div>
    </>
  )
}

function DashApiError() {
  const { t } = useTranslation()
  return (
    <Row className="row-spaced">
      <Col xs={8} xsOffset={2} aria-live="polite" className="text-center">
        <div className="alert alert-danger">
          {t('generic_something_went_wrong')}
        </div>
      </Col>
    </Row>
  )
}

export default ProjectListRoot
