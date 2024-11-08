import { useTranslation } from 'react-i18next'
import { FontFamily } from '../../../source-editor/extensions/theme'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

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
      <OLTooltip
        id="font-family-tooltip"
        description={`${t('new_font_open_dyslexic')} ${t('click_to_give_feedback')}`}
        overlayProps={{ placement: 'right' }}
      >
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLScOt_IHTrcaM_uitP9dgCo_r4dl4cy9Ry6LhYYcwTN4qDTDUg/viewform"
          className="left-menu-setting-icon"
          target="_blank"
          rel="noreferrer noopener"
        >
          <BootstrapVersionSwitcher
            bs3={<span className="info-badge" />}
            bs5={<MaterialIcon type="info" className="info-badge" />}
          />
        </a>
      </OLTooltip>
    </div>
  )
}
