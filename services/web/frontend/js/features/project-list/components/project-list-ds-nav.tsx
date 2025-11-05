import { useProjectListContext } from '../context/project-list-context'
import { useTranslation } from 'react-i18next'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'
import ProjectsDropdown from './dropdown/projects-dropdown'
import SortByDropdown from './dropdown/sort-by-dropdown'
import ProjectTools from './table/project-tools/project-tools'
import ProjectListTitle from './title/project-list-title'
import LoadMore from './load-more'
import OLCol from '@/shared/components/ol/ol-col'
import OLRow from '@/shared/components/ol/ol-row'
import { TableContainer } from '@/shared/components/table'
import DashApiError from '@/features/project-list/components/dash-api-error'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/shared/components/navbar/default-navbar'
import Footer from '@/shared/components/footer/footer'
import SidebarDsNav from '@/features/project-list/components/sidebar/sidebar-ds-nav'
import SystemMessages from '@/shared/components/system-messages'
import overleafLogo from '@/shared/svgs/overleaf-a-ds-solution-mallard.svg'
import overleafLogoDark from '@/shared/svgs/overleaf-a-ds-solution-mallard-dark.svg'
import CookieBanner from '@/shared/components/cookie-banner'
import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'

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
  } = useProjectListContext()
  const activeOverallTheme = useActiveOverallTheme('themed-project-dashboard')

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
    <div className="project-ds-nav-page website-redesign">
      <SystemMessages />
      <DefaultNavbar
        {...navbarProps}
        overleafLogo={
          activeOverallTheme === 'dark' ? overleafLogoDark : overleafLogo
        }
        showCloseIcon
      />
      <div className="project-list-wrapper">
        <SidebarDsNav />
        <div className="project-ds-nav-content-and-messages">
          <div className="project-ds-nav-content">
            <div className="project-ds-nav-main">
              {error ? <DashApiError /> : ''}
              <UserNotifications />
              <main aria-labelledby="main-content">
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
                <div className="project-ds-nav-project-list">
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
                    {/* Omit the survey card in mobile view for now */}
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
