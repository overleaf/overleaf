import { useState, Dispatch, SetStateAction } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import LeaveModalForm, { LeaveModalFormProps } from './modal-form'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

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
  const { isOverleaf } = getMeta('ol-ExposedSettings')
  const hasPassword = getMeta('ol-hasPassword')

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
    <>
      <LeaveModalForm
        setInFlight={setInFlight}
        isFormValid={isFormValid}
        setIsFormValid={setIsFormValid}
      />
      <p>
        <Trans
          i18nKey="if_you_need_to_delete_your_writefull_account"
          components={{
            a: (
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              <a
                href="https://my.writefull.com/account"
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        />
      </p>
    </>
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
      <OLModalHeader>
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
        <OLButton disabled={inFlight} onClick={handleHide} variant="secondary">
          {t('cancel')}
        </OLButton>

        <OLButton
          form="leave-form"
          type="submit"
          variant="danger"
          disabled={inFlight || !isFormValid}
        >
          {inFlight ? <>{t('deleting')}…</> : t('delete')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

export default LeaveModalContent
