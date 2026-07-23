// Register the PnP ESM loader hook so that ESM imports resolve through Yarn PnP.
// This file is intended to be used with --import (Node >= 20.6).
import { register } from 'node:module'

const loaderURL = new URL('.pnp.loader.mjs', import.meta.url)
register(loaderURL, import.meta.url)
