import { FC, useState } from 'react'
import { AngularScopeValueStore } from '@/features/ide-react/scope-value-store/angular-scope-value-store'
import { AngularScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/angular-scope-event-emitter'
import { Ide, IdeProvider } from '@/shared/context/ide-context'
import { getMockIde } from '@/shared/context/mock/mock-ide'

export const IdeAngularProvider: FC<{ ide?: Ide }> = ({ ide, children }) => {
  const [ideValue] = useState(() => ide || getMockIde())
  const [scopeStore] = useState(
    () => new AngularScopeValueStore(ideValue.$scope)
  )
  const [scopeEventEmitter] = useState(
    () => new AngularScopeEventEmitter(ideValue.$scope)
  )

  return (
    <IdeProvider
      ide={ideValue}
      scopeStore={scopeStore}
      scopeEventEmitter={scopeEventEmitter}
    >
      {children}
    </IdeProvider>
  )
}
