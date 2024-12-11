import NewProjectButton from '../new-project-button'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import SurveyWidget from '../survey-widget'
import { usePersistedResize } from '../../../../shared/hooks/use-resize'

function SidebarDsNav() {
  const { show: showAddAffiliationWidget } = useAddAffiliation()
  const { mousePos, getHandleProps, getTargetProps } = usePersistedResize({
    name: 'project-sidebar',
  })

  return (
    <div
      className="project-ds-nav-sidebar d-none d-md-flex"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      <NewProjectButton id="new-project-button-sidebar" />
      <div className="project-list-sidebar-scroll">
        <SidebarFilters withHr />
        {showAddAffiliationWidget && <hr />}
        <AddAffiliation />
      </div>
      <div className="project-list-sidebar-survey-wrapper">
        <SurveyWidget variant="light" />
      </div>
      <div className="bg-warning">
        Help / Profile
        <br />
        DS Nav
      </div>
      <div
        {...getHandleProps({
          style: {
            position: 'absolute',
            zIndex: 1,
            top: 0,
            right: '-2px',
            height: '100%',
            width: '4px',
          },
        })}
      />
    </div>
  )
}

export default SidebarDsNav
