import { Trans } from 'react-i18next'

export default function HotkeysModalBottomText() {
  return (
    <div className="hotkeys-modal-bottom-text">
      <Trans
        i18nKey="a_more_comprehensive_list_of_keyboard_shortcuts"
        components={[
          // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
          <a
            href="/articles/overleaf-keyboard-shortcuts/qykqfvmxdnjf"
            target="_blank"
          />,
        ]}
      />
    </div>
  )
}
