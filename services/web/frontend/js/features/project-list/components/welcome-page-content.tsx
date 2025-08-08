import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import DashApiError from '@/features/project-list/components/dash-api-error'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import UserNotifications from '@/features/project-list/components/notifications/user-notifications'
import WelcomeMessage from '@/features/project-list/components/welcome-message'

export default function WelcomePageContent() {
  const { error } = useProjectListContext()

  return (
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
  )
}
