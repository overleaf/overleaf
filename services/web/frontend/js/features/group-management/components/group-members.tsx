import React, { useCallback, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import getMeta from '../../../utils/meta'
import { useGroupMembersContext } from '../context/group-members-context'
import ErrorAlert from './error-alert'
import MembersList from './members-table/members-list'
import { sendMB } from '../../../infrastructure/event-tracking'
import BackButton from '@/features/group-management/components/back-button'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLCard from '@/features/ui/components/ol/ol-card'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import OLFormText from '@/features/ui/components/ol/ol-form-text'

export default function GroupMembers() {
  const { isReady } = useWaitForI18n()
  const { t } = useTranslation()
  const {
    users,
    selectedUsers,
    addMembers,
    removeMembers,
    removeMemberLoading,
    removeMemberError,
    inviteMemberLoading,
    inviteError,
    paths,
  } = useGroupMembersContext()
  const [emailString, setEmailString] = useState<string>('')

  const groupId = getMeta('ol-groupId')
  const groupName = getMeta('ol-groupName')
  const groupSize = getMeta('ol-groupSize')
  const canUseFlexibleLicensing = getMeta('ol-canUseFlexibleLicensing')
  const canUseAddSeatsFeature = getMeta('ol-canUseAddSeatsFeature')

  const handleEmailsChange = useCallback(
    e => {
      setEmailString(e.target.value)
    },
    [setEmailString]
  )

  if (!isReady) {
    return null
  }

  const onAddMembersSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMembers(emailString)
  }

  const groupSizeDetails = () => {
    if (canUseFlexibleLicensing) {
      return (
        <small data-testid="group-size-details">
          <strong>
            {users.length === 1
              ? t('you_have_1_license_and_your_plan_supports_up_to_y', {
                  groupSize,
                })
              : t('you_have_x_licenses_and_your_plan_supports_up_to_y', {
                  addedUsersSize: users.length,
                  groupSize,
                })}
          </strong>
          {canUseAddSeatsFeature && (
            <>
              {' '}
              <a
                href="/user/subscription/group/add-users"
                rel="noreferrer noopener"
                onClick={() => sendMB('flex-add-users')}
              >
                {t('buy_more_licenses')}.
              </a>
            </>
          )}
        </small>
      )
    }

    return (
      <small>
        <Trans
          i18nKey="you_have_added_x_of_group_size_y"
          components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
          values={{ addedUsersSize: users.length, groupSize }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      </small>
    )
  }

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 10, offset: 1 }}>
          <div className="group-heading" data-testid="group-heading">
            <BackButton
              href="/user/subscription"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h1 className="heading">{groupName || t('group_subscription')}</h1>
          </div>
          <OLCard>
            <div
              className="page-header mb-4"
              data-testid="page-header-members-details"
            >
              <div className="pull-right">
                {selectedUsers.length === 0 && groupSizeDetails()}
                {removeMemberLoading ? (
                  <OLButton variant="danger" disabled>
                    {t('removing')}&hellip;
                  </OLButton>
                ) : (
                  <>
                    {selectedUsers.length > 0 && (
                      <OLButton variant="danger" onClick={removeMembers}>
                        {t('remove_from_group')}
                      </OLButton>
                    )}
                  </>
                )}
              </div>
              <h2 className="h3 mt-0">{t('members_management')}</h2>
            </div>
            <div className="row-spaced-small">
              <ErrorAlert error={removeMemberError} />
              <MembersList groupId={groupId} />
            </div>
            <hr />
            {users.length < groupSize && (
              <div
                className="add-more-members-form"
                data-testid="add-more-members-form"
              >
                <p className="small">{t('invite_more_members')}</p>
                <ErrorAlert error={inviteError} />
                <form onSubmit={onAddMembersSubmit}>
                  <OLRow>
                    <OLCol xs={6}>
                      <OLFormControl
                        type="input"
                        placeholder="jane@example.com, joe@example.com"
                        aria-describedby="add-members-description"
                        value={emailString}
                        onChange={handleEmailsChange}
                      />
                    </OLCol>
                    <OLCol xs={4}>
                      <OLButton
                        variant="primary"
                        onClick={onAddMembersSubmit}
                        isLoading={inviteMemberLoading}
                        loadingLabel={t('inviting')}
                      >
                        {t('invite')}
                      </OLButton>
                    </OLCol>
                    <OLCol xs={2}>
                      <a href={paths.exportMembers}>{t('export_csv')}</a>
                    </OLCol>
                  </OLRow>
                  <OLRow>
                    <OLCol xs={8}>
                      <OLFormText>
                        {t('add_comma_separated_emails_help')}
                      </OLFormText>
                    </OLCol>
                  </OLRow>
                </form>
              </div>
            )}
            {users.length >= groupSize && users.length > 0 && (
              <>
                <ErrorAlert error={inviteError} />
                <OLRow>
                  <OLCol xs={{ span: 2, offset: 10 }}>
                    <a href={paths.exportMembers}>{t('export_csv')}</a>
                  </OLCol>
                </OLRow>
              </>
            )}
          </OLCard>
        </OLCol>
      </OLRow>
    </div>
  )
}
