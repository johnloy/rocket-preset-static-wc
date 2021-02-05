import { rocketLaunch } from '@rocket/launch'
import { staticCustomElements } from '../../index.mjs'

export default {
  presets: [
    rocketLaunch(),
    staticCustomElements({
      customElementFiles: ['**/*.js'],
    }),
  ],
}
