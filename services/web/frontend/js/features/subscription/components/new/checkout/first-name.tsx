import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import useValidateField from '../../../hooks/use-validate-field'
import classnames from 'classnames'
import { callFnsInSequence } from '../../../../../utils/functions'

type FirstNameProps = {
  errorFields: Record<string, boolean> | undefined
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function FirstName(props: FirstNameProps) {
  const { t } = useTranslation()
  const { validate, isValid } = useValidateField()

  return (
    <FormGroup
      controlId="first-name"
      className={classnames({
        'has-error': !isValid || props.errorFields?.first_name,
      })}
    >
      <ControlLabel>{t('first_name')}</ControlLabel>
      <input
        id="first-name"
        className="form-control"
        name="firstName"
        data-recurly="first_name"
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

export default FirstName
