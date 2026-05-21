import { useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import OLButton from '@/shared/components/ol/ol-button'
import OLButtonToolbar from '@/shared/components/ol/ol-button-toolbar'
import MaterialIcon from '@/shared/components/material-icon'
import SplitTestBadge from '@/shared/components/split-test-badge'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { usePythonExecutionContext } from '@/features/ide-react/context/python-execution-context'
import { DEFAULT_STATE } from './python-runner'

const emptySubscribe = () => () => {}
const getDefaultState = () => DEFAULT_STATE

export default function PythonOutputPane() {
  const { t } = useTranslation()
  const { currentDocumentId } = useEditorOpenDocContext()
  const { getPythonRunner } = usePythonExecutionContext()
  const pythonRunner = useMemo(
    () => (currentDocumentId ? getPythonRunner(currentDocumentId) : null),
    [currentDocumentId, getPythonRunner]
  )

  const { output, error, status } = useSyncExternalStore(
    pythonRunner ? pythonRunner.subscribe : emptySubscribe,
    pythonRunner ? pythonRunner.getState : getDefaultState
  )

  if (!pythonRunner) {
    return null
  }

  return (
    <div className="ide-redesign-python-output-pane">
      <OLButtonToolbar className="ide-redesign-python-output-pane-toolbar">
        <div className="ide-redesign-python-output-pane-toolbar-left">
          <div
            className={classNames(
              'ide-redesign-python-output-pane-run-button-wrapper',
              {
                'compile-button-group-running': status === 'running',
              }
            )}
          >
            <OLButton
              onClick={() => {
                if (status === 'running') {
                  pythonRunner.interrupt()
                } else {
                  pythonRunner.run()
                }
              }}
              variant={status === 'running' ? 'danger' : 'primary'}
              className="align-items-center py-0 px-3"
              disabled={status === 'loading'}
              aria-label={
                status === 'running'
                  ? t('stop_python_execution')
                  : t('run_python_code')
              }
            >
              {status === 'running' ? t('stop') : t('run')}
              <MaterialIcon
                type={status === 'running' ? 'stop' : 'play_arrow'}
                className="ml-2"
              />
            </OLButton>
          </div>
          <SplitTestBadge
            splitTestName="overleaf-code"
            displayOnVariants={['enabled']}
          />
        </div>
      </OLButtonToolbar>

      <div className="ide-redesign-python-output-pane-body">
        {status === 'loading' && (
          <div className="ide-redesign-python-output-pane-placeholder">
            {t('loading_python_runtime')}
          </div>
        )}
        {status !== 'loading' && !error && output.length === 0 && (
          <div className="ide-redesign-python-output-pane-placeholder">
            {t('run_current_script_to_see_output')}
          </div>
        )}
        {error && (
          <div className="ide-redesign-python-output-pane-error">{error}</div>
        )}
        {output.map((entry, index) => (
          <div
            className={`ide-redesign-python-output-pane-line ide-redesign-python-output-pane-line-${entry.stream}`}
            key={index}
          >
            {entry.line}
          </div>
        ))}
      </div>
    </div>
  )
}
