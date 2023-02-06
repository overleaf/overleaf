import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import useValidateField from '../../../hooks/use-validate-field'
import classnames from 'classnames'
import { callFnsInSequence } from '../../../../../utils/functions'

type LastNameProps = {
  errorFields: Record<string, boolean> | undefined
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function LastName(props: LastNameProps) {
  const { t } = useTranslation()
  const { validate, isValid } = useValidateField()

  return (
    <FormGroup
      controlId="last-name"
      className={classnames({
        'has-error': !isValid || props.errorFields?.last_name,
      })}
    >
      <ControlLabel>{t('last_name')}</ControlLabel>
      <input
        id="last-name"
        className="form-control"
        name="lastName"
        data-recurly="last_name"
        type="text"
        required
        maxLength={255}
        onBlur={validate}
        onChange={callFnsInSequence(validate, props.onChange)}
        value={props.value}
      />
      {!isValid && (
        <span className="input-feedback-message">
          {t('this_field_is_required')}
        </span>
      )}
    </FormGroup>
  )
}

export default LastName
