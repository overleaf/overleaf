import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import useValidateField from '../../../hooks/use-validate-field'
import classnames from 'classnames'
import { callFnsInSequence } from '../../../../../utils/functions'

type PostalCodeProps = {
  errorFields: Record<string, boolean> | undefined
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function PostalCode(props: PostalCodeProps) {
  const { t } = useTranslation()
  const { validate, isValid } = useValidateField()

  return (
    <FormGroup
      controlId="postal-code"
      className={classnames({
        'has-error': !isValid || props.errorFields?.postal_code,
      })}
    >
      <ControlLabel>{t('postal_code')}</ControlLabel>
      <input
        id="postal-code"
        className="form-control"
        name="postalCode"
        data-recurly="postal_code"
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

export default PostalCode
