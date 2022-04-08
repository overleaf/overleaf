import mapKeys from 'lodash/mapKeys'

export interface NormalizedObject<T> {
  [p: string]: T
}

type Data<T> = T[]
type Config = Partial<{
  idAttribute: string
}>

export function normalize<T>(
  data: Data<T>,
  config: Config = {}
): NormalizedObject<T> | undefined {
  const { idAttribute = 'id' } = config
  const mapped = mapKeys(data, idAttribute)

  return Object.prototype.hasOwnProperty.call(mapped, 'undefined')
    ? undefined
    : mapped
}
