import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import Tooltip from '../../../../../shared/components/tooltip'
import Icon from '../../../../../shared/components/icon'
import useValidateField from '../../../hooks/use-validate-field'
import classnames from 'classnames'
import { callFnsInSequence } from '../../../../../utils/functions'

type AddressFirstLineProps = {
  errorFields: Record<string, boolean> | undefined
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function AddressFirstLine({
  errorFields,
  value,
  onChange,
}: AddressFirstLineProps) {
  const { t } = useTranslation()
  const { validate, isValid } = useValidateField()

  return (
    <FormGroup
      controlId="address-line-1"
      className={classnames({
        'has-error': !isValid || errorFields?.address1,
      })}
    >
      <ControlLabel>
        {t('address_line_1')}{' '}
        <Tooltip
          id="tooltip-address"
          description={t('this_address_will_be_shown_on_the_invoice')}
          overlayProps={{ placement: 'right' }}
        >
          <Icon
            type="question-circle"
            aria-label={t('this_address_will_be_shown_on_the_invoice')}
          />
        </Tooltip>
      </ControlLabel>
      <input
        id="address-line-1"
        className="form-control"
        name="address1"
        data-recurly="address1"
        type="text"
        required
        maxLength={255}
        onBlur={validate}
        onChange={callFnsInSequence(validate, onChange)}
        value={value}
      />
      {!isValid && (
        <span className="input-feedback-message">
          {t('this_field_is_required')}
        </span>
      )}
    </FormGroup>
  )
}

export default AddressFirstLine
