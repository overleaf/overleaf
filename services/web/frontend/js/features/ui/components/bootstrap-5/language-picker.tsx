import React from 'react'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from './dropdown-menu'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import Icon from '@/shared/components/icon'

function LanguagePicker() {
  const { t } = useTranslation()

  const currentLangCode = getMeta('ol-i18n').currentLangCode
  const translatedLanguages = getMeta('ol-footer').translatedLanguages
  const subdomainLang = getMeta('ol-footer').subdomainLang
  const currentUrlWithQueryParams = window.location.pathname

  return (
    <Dropdown drop="up">
      <DropdownToggle
        id="language-picker-toggle"
        aria-label={t('select_a_language')}
        data-bs-toggle="dropdown"
        className="btn-inline-link"
        variant="link"
      >
        <Icon
          type="language"
          className="fa fa-fw"
          accessibilityLabel={t('select_a_language')}
        />
        {translatedLanguages?.[currentLangCode]}
      </DropdownToggle>

      <DropdownMenu
        className="dropdown-menu-sm-width"
        aria-labelledby="language-picker-toggle"
      >
        {subdomainLang &&
          Object.entries(subdomainLang).map(([subdomain, subdomainDetails]) => {
            if (
              !subdomainDetails ||
              !subdomainDetails.lngCode ||
              subdomainDetails.hide
            )
              return null
            const isActive = subdomainDetails.lngCode === currentLangCode
            return (
              <li role="none" key={subdomain}>
                <DropdownItem
                  href={`${subdomainDetails.url}${currentUrlWithQueryParams}`}
                  active={isActive}
                  aria-current={isActive ? 'true' : false}
                  trailingIcon={isActive ? 'check' : null}
                >
                  {translatedLanguages?.[subdomainDetails.lngCode]}
                </DropdownItem>
              </li>
            )
          })}
      </DropdownMenu>
    </Dropdown>
  )
}

export default LanguagePicker
