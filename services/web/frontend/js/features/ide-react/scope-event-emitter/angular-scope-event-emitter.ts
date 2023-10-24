import {
  ScopeEventEmitter,
  ScopeEventName,
} from '../../../../../types/ide/scope-event-emitter'
import { Scope } from '../../../../../types/angular/scope'

export class AngularScopeEventEmitter implements ScopeEventEmitter {
  // eslint-disable-next-line no-useless-constructor
  constructor(readonly $scope: Scope) {}

  emit(eventName: ScopeEventName, broadcast: boolean, ...detail: unknown[]) {
    if (broadcast) {
      this.$scope.$broadcast(eventName, ...detail)
    } else {
      this.$scope.$emit(eventName, ...detail)
    }
  }

  on(eventName: ScopeEventName, listener: (...args: unknown[]) => void) {
    return this.$scope.$on(eventName, listener)
  }
}
