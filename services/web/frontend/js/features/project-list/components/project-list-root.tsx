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
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'
import Notification from '@/shared/components/notification'
import OLRow from '@/features/ui/components/ol/ol-row'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
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
    <div
      className={classnames(
        'pt-2',
        'pb-3',
        bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
      )}
    >
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

      <div
        className={classnames(
          'project-list-wrapper',
          bsVersion({ bs3: 'clearfix container mx-0 px-0' })
        )}
      >
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
                  className={classnames(
                    'text-truncate',
                    bsVersion({
                      bs5: 'd-none d-md-block',
                      bs3: 'hidden-xs',
                    })
                  )}
                />
                <div className="project-tools">
                  <div
                    className={bsVersion({
                      bs5: 'd-none d-md-block',
                      bs3: 'hidden-xs',
                    })}
                  >
                    {selectedProjects.length === 0 ? (
                      <CurrentPlanWidget />
                    ) : (
                      <ProjectTools />
                    )}
                  </div>
                  <div
                    className={bsVersion({
                      bs5: 'd-md-none',
                      bs3: 'visible-xs',
                    })}
                  >
                    <CurrentPlanWidget />
                  </div>
                </div>
              </div>
              <OLRow
                className={bsVersion({
                  bs5: 'd-none d-md-block',
                  bs3: 'hidden-xs',
                })}
              >
                <OLCol lg={7}>
                  <SearchForm
                    inputValue={searchText}
                    setInputValue={setSearchText}
                    filter={filter}
                    selectedTag={selectedTag}
                  />
                </OLCol>
              </OLRow>
              <div
                className={classnames(
                  'project-list-sidebar-survey-wrapper',
                  bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
                )}
              >
                <SurveyWidget />
              </div>
              <div
                className={classnames(
                  'mt-1',
                  bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
                )}
              >
                <div role="toolbar" className="projects-toolbar">
                  <ProjectsDropdown />
                  <SortByDropdown />
                </div>
              </div>
              <OLRow className="row-spaced">
                <OLCol>
                  <BootstrapVersionSwitcher
                    bs3={
                      <div className="card project-list-card">
                        {tableTopArea}
                        <ProjectListTable />
                      </div>
                    }
                    bs5={
                      <TableContainer bordered>
                        {tableTopArea}
                        <ProjectListTable />
                      </TableContainer>
                    }
                  />
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
      <OLCol
        xs={{ span: 8, offset: 2 }}
        bs3Props={{ xs: 8, xsOffset: 2 }}
        aria-live="polite"
      >
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
