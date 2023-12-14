import { addons } from '@storybook/addons'
import { create } from '@storybook/theming'

import './manager.css'

import brandImage from '../public/img/ol-brand/overleaf.svg'

const theme = create({
  base: 'light',
  brandTitle: 'Overleaf',
  brandUrl: 'https://www.overleaf.com',
  brandImage,
})

addons.setConfig({ theme })
