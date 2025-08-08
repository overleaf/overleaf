import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import HasIndividualRecurlySubscription from './has-individual-recurly-subscription'
import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import ManagedUserCannotJoin from './managed-user-cannot-join'
import Notification from '@/shared/components/notification'
import JoinGroup from './join-group'
import AcceptedInvite from './accepted-invite'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'

export type InviteViewTypes =
  | 'invite'
  | 'invite-accepted'
  | 'cancel-personal-subscription'
  | 'managed-user-cannot-join'
  | undefined

function GroupInviteViews() {
  const hasIndividualPaidSubscription = getMeta(
    'ol-hasIndividualPaidSubscription'
  )
  const cannotJoinSubscription = getMeta('ol-cannot-join-subscription')

  useEffect(() => {
    if (cannotJoinSubscription) {
      setView('managed-user-cannot-join')
    } else if (hasIndividualPaidSubscription) {
      setView('cancel-personal-subscription')
    } else {
      setView('invite')
    }
  }, [cannotJoinSubscription, hasIndividualPaidSubscription])
  const [view, setView] = useState<InviteViewTypes>(undefined)

  if (!view) {
    return null
  }

  if (view === 'managed-user-cannot-join') {
    return <ManagedUserCannotJoin />
  } else if (view === 'cancel-personal-subscription') {
    return <HasIndividualRecurlySubscription setView={setView} />
  } else if (view === 'invite') {
    return <JoinGroup setView={setView} />
  } else if (view === 'invite-accepted') {
    return <AcceptedInvite />
  }

  return null
}

export default function GroupInvite() {
  const inviterName = getMeta('ol-inviterName')
  const expired = getMeta('ol-expired')
  const { isReady } = useWaitForI18n()
  const { t } = useTranslation()

  if (!isReady) {
    return null
  }

  return (
    <div className="container" id="main-content">
      {expired && (
        <OLRow>
          <OLCol lg={{ span: 8, offset: 2 }}>
            <Notification type="error" content={t('email_link_expired')} />
          </OLCol>
        </OLRow>
      )}

      <OLRow className="row row-spaced">
        <OLCol lg={{ span: 8, offset: 2 }}>
          <OLPageContentCard>
            <div className="page-header">
              <h1 className="text-center">
                <Trans
                  i18nKey="invited_to_group"
                  values={{ inviterName }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                  components={
                    /* eslint-disable-next-line react/jsx-key */
                    [<span className="team-invite-name" />]
                  }
                />
              </h1>
            </div>
            <GroupInviteViews />
          </OLPageContentCard>
        </OLCol>
      </OLRow>
    </div>
  )
}
