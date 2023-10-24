import { ScopeValueStore } from '../../../../../types/ide/scope-value-store'
import { Scope } from '../../../../../types/angular/scope'
import _ from 'lodash'

export class AngularScopeValueStore implements ScopeValueStore {
  // eslint-disable-next-line no-useless-constructor
  constructor(readonly $scope: Scope) {}

  get(path: string) {
    return _.get(this.$scope, path)
  }

  set(path: string, value: unknown): void {
    this.$scope.$applyAsync(() => _.set(this.$scope, path, value))
  }

  watch<T>(
    path: string,
    callback: (newValue: T) => void,
    deep: boolean
  ): () => void {
    return this.$scope.$watch(
      path,
      (newValue: T) => callback(deep ? _.cloneDeep(newValue) : newValue),
      deep
    )
  }
}
