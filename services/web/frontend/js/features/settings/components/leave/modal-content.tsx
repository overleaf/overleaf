import { useState, Dispatch, SetStateAction } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import LeaveModalForm, { LeaveModalFormProps } from './modal-form'
import { ExposedSettings } from '../../../../../../types/exposed-settings'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/bootstrap-5/wrappers/ol-modal'

type LeaveModalContentProps = {
  handleHide: () => void
  inFlight: boolean
  setInFlight: Dispatch<SetStateAction<boolean>>
}

function LeaveModalContentBlock({
  setInFlight,
  isFormValid,
  setIsFormValid,
}: LeaveModalFormProps) {
  const { t } = useTranslation()
  const { isOverleaf } = getMeta('ol-ExposedSettings') as ExposedSettings
  const hasPassword = getMeta('ol-hasPassword') as boolean

  if (isOverleaf && !hasPassword) {
    return (
      <p>
        <b>
          <a href="/user/password/reset">{t('delete_acct_no_existing_pw')}</a>
        </b>
      </p>
    )
  }

  return (
    <LeaveModalForm
      setInFlight={setInFlight}
      isFormValid={isFormValid}
      setIsFormValid={setIsFormValid}
    />
  )
}

function LeaveModalContent({
  handleHide,
  inFlight,
  setInFlight,
}: LeaveModalContentProps) {
  const { t } = useTranslation()
  const [isFormValid, setIsFormValid] = useState(false)

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('delete_account')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>
          <Trans
            i18nKey="delete_account_warning_message_3"
            components={{ strong: <strong /> }}
          />
        </p>
        <LeaveModalContentBlock
          setInFlight={setInFlight}
          isFormValid={isFormValid}
          setIsFormValid={setIsFormValid}
        />
      </OLModalBody>

      <OLModalFooter>
        <ButtonWrapper
          disabled={inFlight}
          onClick={handleHide}
          variant="secondary"
          bs3Props={{ bsStyle: null, className: 'btn-secondary' }}
        >
          {t('cancel')}
        </ButtonWrapper>

        <ButtonWrapper
          form="leave-form"
          type="submit"
          variant="danger"
          disabled={inFlight || !isFormValid}
        >
          {inFlight ? <>{t('deleting')}…</> : t('delete')}
        </ButtonWrapper>
      </OLModalFooter>
    </>
  )
}

export default LeaveModalContent
