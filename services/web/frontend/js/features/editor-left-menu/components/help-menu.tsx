import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import HelpContactUs from './help-contact-us'
import HelpDocumentation from './help-documentation'
import HelpShowHotkeys from './help-show-hotkeys'

export default function HelpMenu() {
  const { t } = useTranslation()
  const showSupport = getMeta('ol-showSupport')

  return (
    <>
      <h4>{t('help')}</h4>
      <ul className="list-unstyled nav">
        <li>
          <HelpShowHotkeys />
        </li>
        {showSupport ? (
          <>
            <li>
              <HelpDocumentation />
            </li>
            <li>
              <HelpContactUs />
            </li>
          </>
        ) : null}
      </ul>
    </>
  )
}
