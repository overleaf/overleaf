import { useState } from 'react'
import PrimaryButton from './primary-button'
import { useTranslation } from 'react-i18next'
import {
  inReconfirmNotificationPeriod,
  institutionAlreadyLinked,
} from '../../../../utils/selectors'
import { postJSON } from '../../../../../../infrastructure/fetch-json'
import {
  State,
  useUserEmailsContext,
} from '../../../../context/user-email-context'
import { UserEmailData } from '../../../../../../../../types/user-email'
import { UseAsyncReturnType } from '../../../../../../shared/hooks/use-async'
import { ssoAvailableForInstitution } from '../../../../utils/sso'
import ConfirmationModal from './confirmation-modal'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

const getDescription = (
  t: (s: string) => string,
  state: State,
  userEmailData: UserEmailData
) => {
  if (inReconfirmNotificationPeriod(userEmailData)) {
    return t('please_reconfirm_your_affiliation_before_making_this_primary')
  }

  if (userEmailData.confirmedAt) {
    return t('make_email_primary_description')
  }

  const ssoAvailable = ssoAvailableForInstitution(
    userEmailData.affiliation?.institution || null
  )

  if (!institutionAlreadyLinked(state, userEmailData) && ssoAvailable) {
    return t('please_link_before_making_primary')
  }

  return t('please_confirm_your_email_before_making_it_default')
}

type MakePrimaryProps = {
  userEmailData: UserEmailData
  primary?: UserEmailData
  makePrimaryAsync: UseAsyncReturnType
}

function MakePrimary({
  userEmailData,
  primary,
  makePrimaryAsync,
}: MakePrimaryProps) {
  const [show, setShow] = useState(false)
  const { t } = useTranslation()
  const { state, makePrimary, deleteEmail, resetLeaversSurveyExpiration } =
    useUserEmailsContext()

  const handleShowModal = () => setShow(true)
  const handleHideModal = () => setShow(false)
  const handleSetDefaultUserEmail = () => {
    handleHideModal()

    makePrimaryAsync
      .runAsync(
        // 'delete-unconfirmed-primary' is a temporary parameter here to keep backward compatibility.
        // So users with the old version of the frontend don't get their primary email deleted unexpectedly.
        // https://github.com/overleaf/internal/issues/23536
        postJSON('/user/emails/default?delete-unconfirmed-primary', {
          body: {
            email: userEmailData.email,
          },
        })
      )
      .then(() => {
        makePrimary(userEmailData.email)
        if (primary && !primary.confirmedAt) {
          deleteEmail(primary.email)
          resetLeaversSurveyExpiration(primary)
        }
      })
      .catch(() => {})
  }

  if (userEmailData.default) {
    return null
  }

  const isConfirmDisabled = Boolean(
    !userEmailData.confirmedAt ||
      state.isLoading ||
      inReconfirmNotificationPeriod(userEmailData)
  )

  return (
    <>
      {makePrimaryAsync.isLoading ? (
        <PrimaryButton disabled isLoading={state.isLoading}>
          {t('processing_uppercase')}&hellip;
        </PrimaryButton>
      ) : (
        <OLTooltip
          id={`make-primary-${userEmailData.email}`}
          description={getDescription(t, state, userEmailData)}
        >
          {/*
            Disabled buttons don't work with tooltips, due to pointer-events: none,
            so create a wrapper for the tooltip
          */}
          <span>
            <PrimaryButton
              disabled={isConfirmDisabled}
              onClick={handleShowModal}
            >
              {t('make_primary')}
            </PrimaryButton>
          </span>
        </OLTooltip>
      )}
      <ConfirmationModal
        email={userEmailData.email}
        isConfirmDisabled={isConfirmDisabled}
        primary={primary}
        show={show}
        onHide={handleHideModal}
        onConfirm={handleSetDefaultUserEmail}
      />
    </>
  )
}

export default MakePrimary
