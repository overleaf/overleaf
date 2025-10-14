/**
 * Configuration for knip, a tool to find unused exports in a project.
 *
 * To run knip, use the command: bin/npm -w services/web run knip
 *
 * It currently only runs in the frontend web service, but could be
 * adapted to run in the backend as well.
 *
 * This is an initial version built in a hackathon. It is useful but not yet complete.
 * In future we should add it to our CI checks but we need to make it more robust first.
 */

import type { KnipConfig } from 'knip'
import Path from 'path'
import settings from './config/settings.webpack'

const moduleEntryPoints = Object.values(settings.overleafModuleImports).flatMap(
  paths =>
    paths.map(path => {
      const cleanedPath = path.replace(Path.join(__dirname, '/'), '')
      if (cleanedPath.match(/\.(js|jsx|ts|tsx?)$/)) {
        return cleanedPath
      }

      return `${cleanedPath}.{js,jsx,ts,tsx}`
    })
)

const knipConfig: KnipConfig = {
  $schema: 'https://unpkg.com/knip@5/schema.json',
  entry: [
    'frontend/js/pages/**/*.{js,jsx,ts,tsx}',
    'frontend/stories/**/*.{js,jsx,ts,tsx}',
    'test/frontend/**/*.{js,jsx,ts,tsx}',
    'modules/**/test/**/*.{js,jsx,ts,tsx}',
    'modules/**/*.test.{js,jsx,ts,tsx}',
    'modules/**/stories/**/*.{js,jsx,ts,tsx}',
    // TODO: update this when I work out how writefull entry points work
    'modules/writefull/**/*.{js,jsx,ts,tsx}',
    'types/window.ts',
    // Workers are loaded dynamically so we explicitly include all workers
    // here until we work out a way to follow the dynamic imports
    'modules/**/*.worker*',
    'frontend/js/**/*.worker*',
    ...moduleEntryPoints,
  ],
  project: [
    'frontend/js/**/*.{js,jsx,ts,tsx}',
    'modules/**/frontend/**/*.{js,jsx,ts,tsx}',
    '!frontend/js/.storybook/**/*.{js,jsx,ts,tsx}',
  ],
  ignore: [
    // TODO: Files that we should keep around even when unused.
    // I would like to do this in the file itself but I can't seem
    // to work out a way to do that (@knipignore only works for
    // individual exports rather than whole files)
    'frontend/js/shared/components/labs/labs-experiments-widget.tsx',
    'frontend/js/features/ide-redesign/components/tooltip-promo.tsx',
  ],
  ignoreExportsUsedInFile: true,
  ignoreBinaries: ['.*'],
  ignoreDependencies: ['.*'],
  tags: ['-knipignore'],
}

export default knipConfig
