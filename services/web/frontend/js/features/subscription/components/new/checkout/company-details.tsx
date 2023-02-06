import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import { usePaymentContext } from '../../../context/payment-context'
import { PricingFormState } from '../../../context/types/payment-context-value'

type CompanyDetailsProps = {
  taxesCount: number
}

function CompanyDetails(props: CompanyDetailsProps) {
  const { t } = useTranslation()
  const [addCompanyDetailsChecked, setAddCompanyDetailsChecked] =
    useState(false)
  const { pricingFormState, setPricingFormState, applyVatNumber } =
    usePaymentContext()

  const handleAddCompanyDetails = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddCompanyDetailsChecked(e.target.checked)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    name: keyof PricingFormState
  ) => {
    setPricingFormState(s => ({ ...s, [name]: e.target.value }))
  }

  const handleApplyVatNumber = (e: React.FocusEvent<HTMLInputElement>) => {
    applyVatNumber(e.target.value)
  }

  return (
    <>
      <FormGroup>
        <div className="checkbox">
          <ControlLabel>
            <input
              type="checkbox"
              id="add-company-details-checkbox"
              onChange={handleAddCompanyDetails}
            />
            {t('add_company_details')}
          </ControlLabel>
        </div>
      </FormGroup>
      {addCompanyDetailsChecked && (
        <>
          <FormGroup controlId="company-name">
            <ControlLabel>{t('company_name')}</ControlLabel>
            <input
              id="company-name"
              className="form-control"
              name="companyName"
              data-recurly="company"
              type="text"
              onChange={e => handleChange(e, 'company')}
              value={pricingFormState.company}
            />
          </FormGroup>
          {props.taxesCount > 0 && (
            <FormGroup controlId="vat-number">
              <ControlLabel>{t('vat_number')}</ControlLabel>
              <input
                id="vat-number"
                className="form-control"
                name="vatNumber"
                data-recurly="vat_number"
                type="text"
                onChange={e => handleChange(e, 'vat_number')}
                onBlur={handleApplyVatNumber}
                value={pricingFormState.vat_number}
              />
            </FormGroup>
          )}
        </>
      )}
    </>
  )
}

export default CompanyDetails
