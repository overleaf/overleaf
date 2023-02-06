import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import classnames from 'classnames'
import useValidateField from '../../../hooks/use-validate-field'
import countries from '../../../data/countries'
import { callFnsInSequence } from '../../../../../utils/functions'
import { PricingFormState } from '../../../context/types/payment-context-value'
import { usePaymentContext } from '../../../context/payment-context'

type CountrySelectProps = {
  errorFields: Record<string, boolean> | undefined
  value: PricingFormState['country']
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function CountrySelect(props: CountrySelectProps) {
  const { t } = useTranslation()
  const { validate, isValid } = useValidateField()
  const { updateCountry } = usePaymentContext()

  const handleUpdateCountry = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCountry(e.target.value as PricingFormState['country'])
  }

  return (
    <FormGroup
      controlId="country"
      className={classnames({
        'has-error': !isValid || props.errorFields?.country,
      })}
    >
      <ControlLabel>{t('country')}</ControlLabel>
      <select
        id="country"
        className="form-control"
        name="country"
        data-recurly="country"
        required
        onBlur={validate}
        onChange={callFnsInSequence(
          validate,
          props.onChange,
          handleUpdateCountry
        )}
        value={props.value}
      >
        <option disabled value="">
          {t('country')}
        </option>
        <option disabled value="-">
          --------------
        </option>
        {countries.map(country => (
          <option value={country.code} key={country.name}>
            {country.name}
          </option>
        ))}
      </select>
      {!isValid && (
        <span className="input-feedback-message">
          {t('this_field_is_required')}
        </span>
      )}
    </FormGroup>
  )
}

export default CountrySelect
