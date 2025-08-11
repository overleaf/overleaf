import { Trans } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'

export default function HotkeysModalBottomText() {
  return (
    <div className="hotkeys-modal-bottom-text">
      <Trans
        i18nKey="a_more_comprehensive_list_of_keyboard_shortcuts"
        components={[
          // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
          <a
            onClick={() => eventTracking.sendMB('left-menu-hotkeys-template')}
            href="https://www.overleaf.com/articles/overleaf-keyboard-shortcuts/qykqfvmxdnjf"
            target="_blank"
            rel="noreferrer"
          />,
        ]}
      />
    </div>
  )
}
