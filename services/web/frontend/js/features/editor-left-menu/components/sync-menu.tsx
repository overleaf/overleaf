import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import getMeta from '../../../utils/meta'

export default function SyncMenu() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous') as boolean | undefined
  const [editorLeftMenuSync] = useState<any[]>(
    () =>
      getMeta('editorLeftMenuSync') ||
      importOverleafModules('editorLeftMenuSync')
  )

  if (anonymous === true || anonymous === undefined) {
    return null
  }

  if (editorLeftMenuSync.length === 0) {
    return null
  }

  return (
    <>
      <h4>{t('sync')}</h4>
      <ul className="list-unstyled nav">
        {editorLeftMenuSync.map(({ import: importObject }) => (
          <li key={Object.keys(importObject)[0]}>
            <ModuleComponent Component={Object.values(importObject)[0]} />
          </li>
        ))}
      </ul>
    </>
  )
}

type ModuleComponentProps = {
  Component: any
}

function ModuleComponent({ Component }: ModuleComponentProps) {
  return <Component />
}
