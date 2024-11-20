import NewProjectButton from '../new-project-button'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import SurveyWidget from '../survey-widget'
import { usePersistedResize } from '../../../../shared/hooks/use-resize'

function Sidebar() {
  const { show: showAddAffiliationWidget } = useAddAffiliation()
  const { mousePos, getHandleProps, getTargetProps } = usePersistedResize({
    name: 'project-sidebar',
  })

  return (
    <div
      className="project-list-sidebar-wrapper-react d-none d-md-block"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      <div className="project-list-sidebar-subwrapper">
        <aside className="project-list-sidebar-react">
          <NewProjectButton id="new-project-button-sidebar" />
          <SidebarFilters />
          {showAddAffiliationWidget && <hr />}
          <AddAffiliation />
        </aside>
        <div className="project-list-sidebar-survey-wrapper">
          <SurveyWidget />
        </div>
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

export default Sidebar
