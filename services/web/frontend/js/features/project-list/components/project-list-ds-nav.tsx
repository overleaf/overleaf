import classNames from 'classnames'
import { useProjectListContext } from '../context/project-list-context'
import { useTranslation } from 'react-i18next'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'
import NavigationDropdown from './dropdown/navigation-dropdown'
import SortByDropdown from './dropdown/sort-by-dropdown'
import ProjectTools from './table/project-tools/project-tools'
import ProjectListTitle from './title/project-list-title'
import TrashPageTabs from './trash/trash-page-tabs'
import LoadMore from './load-more'
import OLCol from '@/shared/components/ol/ol-col'
import OLRow from '@/shared/components/ol/ol-row'
import { TableContainer } from '@/shared/components/ol/ol-table'
import DashApiError from '@/features/project-list/components/dash-api-error'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/shared/components/navbar/default-navbar'
import Footer from '@/shared/components/footer/footer'
import SidebarDsNav from '@/features/project-list/components/sidebar/sidebar-ds-nav'
import SystemMessages from '@/shared/components/system-messages'
import overleafLogo from '@/shared/svgs/overleaf-a-ds-solution-mallard.svg'
import overleafLogoDark from '@/shared/svgs/overleaf-a-ds-solution-mallard-dark.svg'
import CookieBanner from '@/shared/components/cookie-banner'
import NoProjects from '@/features/project-list/components/no-projects'
import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function ProjectListDsNav() {
  const navbarProps = getMeta('ol-navbar')
  const footerProps = getMeta('ol-footer')
  const { t } = useTranslation()
  const {
    error,
    searchText,
    setSearchText,
    selectedProjects,
    filter,
    tags,
    selectedTagId,
    currentFilterProjectsCount,
  } = useProjectListContext()
  const activeOverallTheme = useActiveOverallTheme()
  const isSharedWorkspaceEnabled = useFeatureFlag('shared-workspace')

  const selectedTag = tags.find(tag => tag._id === selectedTagId)
  const showTrashHeader = filter === 'trashed'
  const showNewProjectButton =
    filter !== 'shared' && filter !== 'archived' && filter !== 'trashed'

  const tableTopArea = (
    <div className="pt-2 pb-3 d-md-none d-flex gap-2">
      <SearchForm
        inputValue={searchText}
        setInputValue={setSearchText}
        filter={filter}
        selectedTag={selectedTag}
        className="overflow-hidden flex-grow-1"
      />
      {showNewProjectButton && (
        <NewProjectButton
          id="new-project-button-projects-table"
          showAddAffiliationWidget
          align="end"
        />
      )}
    </div>
  )

  return (
    <div
      className={classNames('project-ds-nav-page', 'website-redesign', {
        'ds-nav-hides-top-navbar': showTrashHeader,
      })}
    >
      <SystemMessages />
      <DefaultNavbar
        {...navbarProps}
        customLogo={
          activeOverallTheme === 'dark'
            ? navbarProps.customLogoDark
            : navbarProps.customLogo
        }
        overleafLogo={
          activeOverallTheme === 'dark' ? overleafLogoDark : overleafLogo
        }
        showCloseIcon
      />
      <div className="project-list-wrapper">
        <SidebarDsNav activePage="projects" />
        <div className="project-ds-nav-content-and-messages">
          <div className="project-ds-nav-content">
            <div className="project-ds-nav-main">
              {error ? <DashApiError /> : ''}
              <UserNotifications />
              <main aria-labelledby="main-content">
                <div className="project-list-header-row">
                  {showTrashHeader ? (
                    <h1
                      id="main-content"
                      tabIndex={-1}
                      className="project-list-title text-truncate d-none d-md-block mb-0"
                    >
                      {t('trash')}
                    </h1>
                  ) : (
                    <ProjectListTitle
                      filter={filter}
                      selectedTag={selectedTag}
                      selectedTagId={selectedTagId}
                      className="text-truncate d-none d-md-block"
                    />
                  )}
                  <div className="project-tools">
                    <div className="d-none d-md-block">
                      {selectedProjects.length === 0 ? (
                        showTrashHeader ? null : (
                          <CurrentPlanWidget />
                        )
                      ) : (
                        <ProjectTools />
                      )}
                    </div>
                    <div className="d-md-none">
                      {!showTrashHeader && <CurrentPlanWidget />}
                    </div>
                  </div>
                </div>
                {showTrashHeader && <TrashPageTabs activeTab="projects" />}
                {isSharedWorkspaceEnabled &&
                selectedTagId === undefined &&
                currentFilterProjectsCount === 0 ? (
                  <>
                    <ProjectsToolbarMobile />
                    <NoProjects
                      activeSection={filter}
                      showNewProjectButton={showNewProjectButton}
                    />
                  </>
                ) : (
                  <div className="project-ds-nav-project-list">
                    <OLRow className="d-none d-md-flex align-items-center">
                      <OLCol md={8} lg={7}>
                        <SearchForm
                          inputValue={searchText}
                          setInputValue={setSearchText}
                          filter={filter}
                          selectedTag={selectedTag}
                        />
                      </OLCol>
                      {showNewProjectButton && (
                        <OLCol className="ms-auto" xs="auto">
                          <NewProjectButton
                            id="new-project-button-projects-table"
                            showAddAffiliationWidget
                            align="end"
                          />
                        </OLCol>
                      )}
                    </OLRow>
                    <div className="project-list-sidebar-survey-wrapper d-md-none">
                      {/* Omit the survey card in mobile view for now */}
                    </div>
                    <ProjectsToolbarMobile />
                    <div className="mt-3">
                      <TableContainer bordered>
                        {tableTopArea}
                        <ProjectListTable />
                      </TableContainer>
                    </div>
                    <div className="mt-3">
                      <LoadMore />
                    </div>
                  </div>
                )}
              </main>
            </div>
            <Footer {...footerProps} />
          </div>
          <CookieBanner />
        </div>
      </div>
    </div>
  )
}

function ProjectsToolbarMobile() {
  const { t } = useTranslation()

  return (
    <div className="mt-1 d-md-none">
      <div
        role="toolbar"
        className="projects-toolbar"
        aria-label={t('projects')}
      >
        <NavigationDropdown activePage="projects" />
        <SortByDropdown />
      </div>
    </div>
  )
}
