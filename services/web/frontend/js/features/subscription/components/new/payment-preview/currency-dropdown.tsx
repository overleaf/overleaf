import { useTranslation } from 'react-i18next'
import { Dropdown, DropdownProps, MenuItem } from 'react-bootstrap'
import Icon from '../../../../../shared/components/icon'
import { usePaymentContext } from '../../../context/payment-context'

function CurrencyDropdown(props: DropdownProps) {
  const { t } = useTranslation()
  const { currencyCode, limitedCurrencies, changeCurrency } =
    usePaymentContext()

  return (
    <Dropdown {...props}>
      <Dropdown.Toggle
        className="change-currency-toggle"
        bsStyle="link"
        noCaret
      >
        {t('change_currency')}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {Object.entries(limitedCurrencies).map(([currency, symbol]) => (
          <MenuItem
            eventKey={currency}
            key={currency}
            onSelect={eventKey => changeCurrency(eventKey)}
          >
            {currency === currencyCode && (
              <span className="change-currency-dropdown-selected-icon">
                <Icon type="check" accessibilityLabel={t('selected')} />
              </span>
            )}
            {currency} ({symbol})
          </MenuItem>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default CurrencyDropdown
