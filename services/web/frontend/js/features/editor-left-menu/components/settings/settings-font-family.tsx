import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import BetaBadge from '@/shared/components/beta-badge'
import { FontFamily } from '@/shared/utils/styles'

export default function SettingsFontFamily() {
  const { t } = useTranslation()
  const { fontFamily, setFontFamily } = useProjectSettingsContext()

  return (
    <div className="left-menu-setting-position">
      <SettingsMenuSelect<FontFamily>
        onChange={setFontFamily}
        value={fontFamily}
        options={[
          {
            value: 'monaco',
            label: 'Monaco / Menlo / Consolas',
          },
          {
            value: 'lucida',
            label: 'Lucida / Source Code Pro',
          },
          {
            value: 'opendyslexicmono',
            label: 'OpenDyslexic Mono',
          },
        ]}
        label={t('font_family')}
        name="fontFamily"
      />
      <BetaBadge
        phase="release"
        link={{
          href: 'https://docs.google.com/forms/d/e/1FAIpQLScOt_IHTrcaM_uitP9dgCo_r4dl4cy9Ry6LhYYcwTN4qDTDUg/viewform',
          className: 'left-menu-setting-icon',
        }}
        tooltip={{
          id: 'font-family-tooltip',
          text: `${t('new_font_open_dyslexic')} ${t('click_to_give_feedback')}`,
          placement: 'right',
        }}
      />
    </div>
  )
}
