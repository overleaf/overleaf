import { ReactNode } from 'react'
import { UserEmailData } from '../../../../../../types/user-email'
import classNames from 'classnames'
import getMeta from '../../../../utils/meta'
import ReconfirmationInfoSuccess from './reconfirmation-info/reconfirmation-info-success'
import ReconfirmationInfoPrompt from './reconfirmation-info/reconfirmation-info-prompt'
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'
import ColWrapper from '@/features/ui/components/bootstrap-5/wrappers/col-wrapper'

type ReconfirmationInfoProps = {
  userEmailData: UserEmailData
}

function ReconfirmationInfo({ userEmailData }: ReconfirmationInfoProps) {
  const reconfirmationRemoveEmail = getMeta(
    'ol-reconfirmationRemoveEmail'
  ) as string
  const reconfirmedViaSAML = getMeta('ol-reconfirmedViaSAML') as string

  if (!userEmailData.affiliation) {
    return null
  }

  if (
    userEmailData.samlProviderId &&
    userEmailData.samlProviderId === reconfirmedViaSAML
  ) {
    return (
      <ReconfirmationInfoContentWrapper asAlertInfo>
        <ReconfirmationInfoSuccess
          institution={userEmailData.affiliation.institution}
        />
      </ReconfirmationInfoContentWrapper>
    )
  }

  if (userEmailData.affiliation.inReconfirmNotificationPeriod) {
    return (
      <ReconfirmationInfoContentWrapper
        asAlertInfo={reconfirmationRemoveEmail === userEmailData.email}
      >
        <ReconfirmationInfoPrompt
          institution={userEmailData.affiliation.institution}
          primary={userEmailData.default}
          email={userEmailData.email}
        />
      </ReconfirmationInfoContentWrapper>
    )
  }

  return null
}

type ReconfirmationInfoContentWrapperProps = {
  asAlertInfo: boolean
  children: ReactNode
}

function ReconfirmationInfoContentWrapper({
  asAlertInfo,
  children,
}: ReconfirmationInfoContentWrapperProps) {
  return (
    <RowWrapper>
      <ColWrapper md={12}>
        <div
          className={classNames('settings-reconfirm-info', 'small', {
            'alert alert-info': asAlertInfo,
          })}
        >
          {children}
        </div>
      </ColWrapper>
    </RowWrapper>
  )
}

export default ReconfirmationInfo
