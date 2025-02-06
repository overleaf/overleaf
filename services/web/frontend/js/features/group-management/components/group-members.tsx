import React, { useCallback, useState } from 'react'
import { Button, Col, Form, FormControl, Row } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import MaterialIcon from '../../../shared/components/material-icon'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import getMeta from '../../../utils/meta'
import { useGroupMembersContext } from '../context/group-members-context'
import ErrorAlert from './error-alert'
import MembersList from './members-table/members-list'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { sendMB } from '../../../infrastructure/event-tracking'

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
  const isFlexibleGroupLicensingFeatureFlagEnabled = useFeatureFlag(
    'flexible-group-licensing'
  )

  const groupId = getMeta('ol-groupId')
  const groupName = getMeta('ol-groupName')
  const groupSize = getMeta('ol-groupSize')
  const canUseFlexibleLicensing = getMeta('ol-canUseFlexibleLicensing')
  const canUseAddSeatsFeature = getMeta('ol-canUseAddSeatsFeature')
  const isFlexibleGroupLicensing =
    canUseFlexibleLicensing && isFlexibleGroupLicensingFeatureFlagEnabled

  const handleEmailsChange = useCallback(
    e => {
      setEmailString(e.target.value)
    },
    [setEmailString]
  )

  if (!isReady) {
    return null
  }

  const onAddMembersSubmit = (e: React.FormEvent<Form>) => {
    e.preventDefault()
    addMembers(emailString)
  }

  const groupSizeDetails = () => {
    if (isFlexibleGroupLicensing) {
      return (
        <small data-testid="group-size-details">
          <strong>
            {users.length === 1
              ? t('you_have_1_user_and_your_plan_supports_up_to_y', {
                  groupSize,
                })
              : t('you_have_x_users_and_your_plan_supports_up_to_y', {
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
                {t('add_more_users')}.
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
      <Row>
        <Col md={10} mdOffset={1}>
          <h1>
            <a href="/user/subscription" className="back-btn">
              <MaterialIcon
                type="arrow_back"
                accessibilityLabel={t('back_to_subscription')}
              />
            </a>{' '}
            {groupName || t('group_subscription')}
          </h1>
          <div className="card">
            <div className="page-header">
              <div className="pull-right">
                {selectedUsers.length === 0 && groupSizeDetails()}
                {removeMemberLoading ? (
                  <Button bsStyle="danger" disabled>
                    {t('removing')}&hellip;
                  </Button>
                ) : (
                  <>
                    {selectedUsers.length > 0 && (
                      <Button bsStyle="danger" onClick={removeMembers}>
                        {t('remove_from_group')}
                      </Button>
                    )}
                  </>
                )}
              </div>
              <h3>{t('members_management')}</h3>
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
                <p className="small">
                  {isFlexibleGroupLicensing
                    ? t('invite_more_members')
                    : t('add_more_members')}
                </p>
                <ErrorAlert error={inviteError} />
                <Form horizontal onSubmit={onAddMembersSubmit} className="form">
                  <Row>
                    <Col xs={6}>
                      <FormControl
                        type="input"
                        placeholder="jane@example.com, joe@example.com"
                        aria-describedby="add-members-description"
                        value={emailString}
                        onChange={handleEmailsChange}
                      />
                    </Col>
                    <Col xs={4}>
                      {inviteMemberLoading ? (
                        <Button bsStyle="primary" disabled>
                          {isFlexibleGroupLicensing
                            ? t('inviting')
                            : t('adding')}
                          &hellip;
                        </Button>
                      ) : (
                        <Button bsStyle="primary" onClick={onAddMembersSubmit}>
                          {isFlexibleGroupLicensing ? t('invite') : t('add')}
                        </Button>
                      )}
                    </Col>
                    <Col xs={2}>
                      <a href={paths.exportMembers}>{t('export_csv')}</a>
                    </Col>
                  </Row>
                  <Row>
                    <Col xs={8}>
                      <span className="help-block">
                        {t('add_comma_separated_emails_help')}
                      </span>
                    </Col>
                  </Row>
                </Form>
              </div>
            )}
            {users.length >= groupSize && users.length > 0 && (
              <>
                <ErrorAlert error={inviteError} />
                <Row>
                  <Col xs={2} xsOffset={10}>
                    <a href={paths.exportMembers}>{t('export_csv')}</a>
                  </Col>
                </Row>
              </>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}
