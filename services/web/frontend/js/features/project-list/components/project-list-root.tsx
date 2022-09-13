import {
  ProjectListProvider,
  useProjectListContext,
} from '../context/project-list-context'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import SidebarFilters from './sidebar/sidebar-filters'
import SurveyWidget from './survey-widget'
import WelcomeMessage from './welcome-message'
import LoadingBranded from '../../../shared/components/loading-branded'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'

function ProjectListRoot() {
  const { isReady } = useWaitForI18n()

  return isReady ? (
    <ProjectListProvider>
      <ProjectListPageContent />
    </ProjectListProvider>
  ) : null
}

function ProjectListPageContent() {
  const { totalProjectsCount, error, isLoading, loadProgress, setSearchText } =
    useProjectListContext()

  return isLoading ? (
    <div className="loading-container">
      <LoadingBranded loadProgress={loadProgress} />
    </div>
  ) : (
    <div className="project-list-row row fill">
      <div className="project-list-wrapper">
        {error ? <DashApiError /> : ''}
        {totalProjectsCount > 0 ? (
          <>
            <Col md={2} xs={3} className="project-list-sidebar-wrapper">
              <aside className="project-list-sidebar">
                <NewProjectButton />
                <SidebarFilters />
              </aside>
              <SurveyWidget />
            </Col>
            <Col md={10} xs={9} className="project-list-main">
              <Row>
                <Col xs={12}>
                  <UserNotifications />
                </Col>
              </Row>
              <Row>
                <Col md={7} xs={12}>
                  <SearchForm onChange={setSearchText} />
                </Col>
                <Col md={5} xs={12}>
                  <div className="project-tools">
                    <div className="text-right pull-right">
                      <CurrentPlanWidget />
                    </div>
                  </div>
                </Col>
              </Row>
              <Row className="row-spaced">
                <Col xs={12}>
                  <ProjectListTable />
                </Col>
              </Row>
            </Col>
          </>
        ) : (
          <Row className="row-spaced">
            <Col
              xs={8}
              xsOffset={2}
              md={8}
              mdOffset={2}
              className="project-list-empty-col"
            >
              <WelcomeMessage />
            </Col>
          </Row>
        )}
      </div>
    </div>
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
