import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import HotkeysModalBottomText from './hotkeys-modal-bottom-text'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'

export default function HotkeysModal({
  animation = true,
  handleHide,
  show,
  isMac = false,
  trackChangesVisible = false,
}) {
  const { t } = useTranslation()

  const ctrl = isMac ? 'Cmd' : 'Ctrl'

  return (
    <OLModal size="lg" onHide={handleHide} show={show} animation={animation}>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('hotkeys')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody className="hotkeys-modal">
        <h3>{t('common')}</h3>

        <OLRow>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + F`}
              description={t('hotkey_find_and_replace')}
            />
            <Hotkey
              combination={`${ctrl} + Enter`}
              description={t('hotkey_compile')}
            />
          </OLCol>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + Z`}
              description={t('hotkey_undo')}
            />
          </OLCol>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + Y`}
              description={t('hotkey_redo')}
            />
          </OLCol>
        </OLRow>

        <h3>{t('navigation')}</h3>

        <OLRow>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + Home`}
              description={t('hotkey_beginning_of_document')}
            />
          </OLCol>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + End`}
              description={t('hotkey_end_of_document')}
            />
          </OLCol>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + Shift + L`}
              description={t('hotkey_go_to_line')}
            />
          </OLCol>
        </OLRow>

        <h3>{t('editing')}</h3>

        <OLRow>
          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + /`}
              description={t('hotkey_toggle_comment')}
            />
            <Hotkey
              combination={`${ctrl} + D`}
              description={t('hotkey_delete_current_line')}
            />
            <Hotkey
              combination={`${ctrl} + A`}
              description={t('hotkey_select_all')}
            />
          </OLCol>

          <OLCol xs={4}>
            <Hotkey
              combination="Ctrl + U"
              description={t('hotkey_to_uppercase')}
            />
            <Hotkey
              combination="Ctrl + Shift + U"
              description={t('hotkey_to_lowercase')}
            />
            <Hotkey
              combination="Tab"
              description={t('hotkey_indent_selection')}
            />
          </OLCol>

          <OLCol xs={4}>
            <Hotkey
              combination={`${ctrl} + B`}
              description={t('hotkey_bold_text')}
            />
            <Hotkey
              combination={`${ctrl} + I`}
              description={t('hotkey_italic_text')}
            />
          </OLCol>
        </OLRow>

        <h3>{t('autocomplete')}</h3>

        <OLRow>
          <OLCol xs={4}>
            <Hotkey
              combination="Ctrl + Space"
              description={t('hotkey_autocomplete_menu')}
            />
          </OLCol>
          <OLCol xs={4}>
            <Hotkey
              combination="Up / Down"
              description={t('hotkey_select_candidate')}
            />
          </OLCol>
          <OLCol xs={4}>
            <Hotkey
              combination="Enter / Tab"
              description={t('hotkey_insert_candidate')}
            />
          </OLCol>
        </OLRow>

        <h3>
          <Trans
            i18nKey="autocomplete_references"
            components={{ code: <code /> }}
          />
        </h3>

        <OLRow>
          <OLCol xs={4}>
            <Hotkey
              combination={`Ctrl + Space `}
              description={t('hotkey_search_references')}
            />
          </OLCol>
        </OLRow>

        {trackChangesVisible && (
          <>
            <h3>{t('review')}</h3>

            <OLRow>
              <OLCol xs={4}>
                <Hotkey
                  combination={`${ctrl} + J`}
                  description={t('hotkey_toggle_review_panel')}
                />
              </OLCol>
              <OLCol xs={4}>
                <Hotkey
                  combination={`${ctrl} + Shift + A`}
                  description={t('hotkey_toggle_track_changes')}
                />
              </OLCol>
              <OLCol xs={4}>
                <Hotkey
                  combination={`${ctrl} + Shift + C`}
                  description={t('hotkey_add_a_comment')}
                />
              </OLCol>
            </OLRow>
          </>
        )}
        <HotkeysModalBottomText />
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleHide}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

HotkeysModal.propTypes = {
  animation: PropTypes.bool,
  isMac: PropTypes.bool,
  show: PropTypes.bool.isRequired,
  handleHide: PropTypes.func.isRequired,
  trackChangesVisible: PropTypes.bool,
}

function Hotkey({ combination, description }) {
  return (
    <div className="hotkey" data-test-selector="hotkey">
      <span className="combination">{combination}</span>
      <span className="description">{description}</span>
    </div>
  )
}
Hotkey.propTypes = {
  combination: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
}
