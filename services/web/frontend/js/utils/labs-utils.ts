import getMeta from './meta'

// Should be `never` when no experiments are active. Otherwise it should be a
// union of active experiment names e.g. `'experiment1' | 'experiment2'`
export type ActiveExperiment = 'monthly-texlive' | 'ai-workbench'

export const isInExperiment = (experiment: ActiveExperiment): boolean => {
  const experiments = getMeta('ol-labsExperiments')
  return Boolean(experiments?.includes(experiment))
}
