import { useState, Dispatch, SetStateAction } from 'react'
import { Modal, Button } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import LeaveModalForm, { LeaveModalFormProps } from './modal-form'
import { ExposedSettings } from '../../../../../../types/exposed-settings'

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
      <Modal.Header closeButton>
        <Modal.Title>{t('delete_account')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>
          <Trans
            i18nKey="delete_account_warning_message_3"
            components={[<strong />]} // eslint-disable-line react/jsx-key
          />
        </p>
        <LeaveModalContentBlock
          setInFlight={setInFlight}
          isFormValid={isFormValid}
          setIsFormValid={setIsFormValid}
        />
      </Modal.Body>

      <Modal.Footer>
        <Button type="button" disabled={inFlight} onClick={handleHide}>
          {t('cancel')}
        </Button>

        <Button
          form="leave-form"
          type="submit"
          bsStyle="danger"
          disabled={inFlight || !isFormValid}
        >
          {inFlight ? <>{t('deleting')}…</> : t('delete')}
        </Button>
      </Modal.Footer>
    </>
  )
}

export default LeaveModalContent
