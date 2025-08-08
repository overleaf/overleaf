import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { useLocation } from '@/shared/hooks/use-location'
import GroupInvitesItem from './group-invites-item'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'

function GroupInvites() {
  const { t } = useTranslation()
  const teamInvites = getMeta('ol-teamInvites')
  const location = useLocation()

  useEffect(() => {
    if (teamInvites.length === 0) {
      location.assign('/project')
    }
  }, [teamInvites, location])

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          <h1>{t('group_invitations')}</h1>
        </OLCol>
      </OLRow>
      {teamInvites.map(teamInvite => (
        <GroupInvitesItem teamInvite={teamInvite} key={teamInvite._id} />
      ))}
    </div>
  )
}

export default GroupInvites
