import { FC } from 'react'
import { AngularScopeValueStore } from '@/features/ide-react/scope-value-store/angular-scope-value-store'
import { AngularScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/angular-scope-event-emitter'
import { Ide, IdeProvider } from '@/shared/context/ide-context'

export const IdeAngularProvider: FC<{ ide: Ide }> = ({ ide, children }) => {
  return (
    <IdeProvider
      ide={ide}
      scopeStore={new AngularScopeValueStore(ide.$scope)}
      scopeEventEmitter={new AngularScopeEventEmitter(ide.$scope)}
    >
      {children}
    </IdeProvider>
  )
}
