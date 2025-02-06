import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useLocalCompileContext } from '@/shared/context/local-compile-context'
import { useWordCount } from '../hooks/use-word-count'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLButton from '@/features/ui/components/ol/ol-button'
import Icon from '@/shared/components/icon'
import { Spinner } from 'react-bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

// NOTE: this component is only mounted when the modal is open
export default function WordCountModalContent({ handleHide }) {
  const { _id: projectId } = useProjectContext()
  const { clsiServerId } = useLocalCompileContext()
  const { t } = useTranslation()
  const { data, error, loading } = useWordCount(projectId, clsiServerId)

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('word_count')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {loading && !error && (
          <div className="loading">
            <BootstrapVersionSwitcher
              bs3={<Icon type="refresh" spin fw />}
              bs5={
                <Spinner
                  animation="border"
                  aria-hidden="true"
                  size="sm"
                  role="status"
                />
              }
            />
            &nbsp;
            {t('loading')}…
          </div>
        )}

        {error && (
          <OLNotification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}

        {data && (
          <div className="container-fluid">
            {data.messages && (
              <OLRow>
                <OLCol xs={12}>
                  <OLNotification
                    type="error"
                    content={
                      <p style={{ whiteSpace: 'pre-wrap' }}>{data.messages}</p>
                    }
                  />
                </OLCol>
              </OLRow>
            )}

            <OLRow>
              <OLCol xs={4}>
                <div className="pull-right">{t('total_words')}:</div>
              </OLCol>
              <OLCol xs={6}>{data.textWords}</OLCol>
            </OLRow>

            <OLRow>
              <OLCol xs={4}>
                <div className="pull-right">{t('headers')}:</div>
              </OLCol>
              <OLCol xs={6}>{data.headers}</OLCol>
            </OLRow>

            <OLRow>
              <OLCol xs={4}>
                <div className="pull-right">{t('math_inline')}:</div>
              </OLCol>
              <OLCol xs={6}>{data.mathInline}</OLCol>
            </OLRow>

            <OLRow>
              <OLCol xs={4}>
                <div className="pull-right">{t('math_display')}:</div>
              </OLCol>
              <OLCol xs={6}>{data.mathDisplay}</OLCol>
            </OLRow>
          </div>
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleHide}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

WordCountModalContent.propTypes = {
  handleHide: PropTypes.func.isRequired,
}
