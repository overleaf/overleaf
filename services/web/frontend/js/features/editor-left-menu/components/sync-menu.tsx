import { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import getMeta from '../../../utils/meta'

const components = importOverleafModules('editorLeftMenuSync') as {
  import: { default: ElementType }
  path: string
}[]

export default function SyncMenu() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous')
  const gitBridgeEnabled = getMeta('ol-gitBridgeEnabled')

  if (anonymous) {
    return null
  }

  if (components.length === 0) {
    return null
  }

  // This flag can only be false in CE and Server Pro. In this case we skip rendering the
  // entire sync section, since Dropbox and GitHub are never available in SP
  if (!gitBridgeEnabled) {
    return null
  }

  return (
    <>
      <h4>{t('sync')}</h4>
      <ul className="list-unstyled nav">
        {components.map(({ import: { default: Component }, path }) => (
          <li key={path}>
            <Component />
          </li>
        ))}
      </ul>
    </>
  )
}
