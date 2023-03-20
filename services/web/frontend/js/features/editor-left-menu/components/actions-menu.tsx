import { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import ActionsCopyProject from './actions-copy-project'
import ActionsWordCount from './actions-word-count'

const components = importOverleafModules('editorLeftMenuManageTemplate') as {
  import: { default: ElementType }
  path: string
}[]

export default function ActionsMenu() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous') as boolean | undefined

  if (anonymous === true || anonymous === undefined) {
    return null
  }

  return (
    <>
      <h4>{t('actions')}</h4>
      <ul className="list-unstyled nav">
        <li>
          <ActionsCopyProject />
        </li>
        {components.map(({ import: { default: Component }, path }) => (
          <li key={path}>
            <Component />
          </li>
        ))}
        <li>
          <ActionsWordCount />
        </li>
      </ul>
    </>
  )
}
