import React from 'react'
import {
  OLDropdown,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
  OLDropdownHeader,
} from './ol/ol-dropdown-menu'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import MaterialIcon from '@/shared/components/material-icon'

function LanguagePicker({ showHeader } = { showHeader: false }) {
  const { t } = useTranslation()

  const currentLangCode = getMeta('ol-i18n').currentLangCode
  const translatedLanguages = getMeta('ol-footer').translatedLanguages
  const subdomainLang = getMeta('ol-footer').subdomainLang
  const currentUrlWithQueryParams = window.location.pathname

  return (
    <OLDropdown drop="up">
      <OLDropdownToggle
        id="language-picker-toggle"
        aria-label={t('select_a_language')}
        data-bs-toggle="dropdown"
        className="btn-inline-link"
        variant="link"
      >
        <MaterialIcon type="translate" />
        &nbsp;
        <span className="language-picker-text">
          {translatedLanguages?.[currentLangCode]}
        </span>
      </OLDropdownToggle>

      <OLDropdownMenu
        className="dropdown-menu-sm-width"
        aria-labelledby="language-picker-toggle"
      >
        {showHeader ? (
          <OLDropdownHeader>{t('language')}</OLDropdownHeader>
        ) : null}
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
              <li role="none" key={subdomain} translate="no">
                <OLDropdownItem
                  href={`${subdomainDetails.url}${currentUrlWithQueryParams}`}
                  active={isActive}
                  aria-current={isActive ? 'true' : false}
                  trailingIcon={isActive ? 'check' : null}
                >
                  {translatedLanguages?.[subdomainDetails.lngCode]}
                </OLDropdownItem>
              </li>
            )
          })}
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default LanguagePicker
