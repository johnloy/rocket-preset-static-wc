declare module '@rocket/cli' {
  interface RocketConfig {
    inputDir: 'string'
  }

  export function getComputedConfig(): RocketConfig
}

// 😡 Ugh!
// https://github.com/11ty/eleventy/issues/1459
// https://github.com/11ty/eleventy/pull/720/files
// https://github.com/NotWoods/11ty-plugins/tree/typescript/packages/types

type EleventyPlugin<Options = undefined> =
  | EleventyPluginFunction<Options>
  | EleventyPluginObject<Options>

type EleventyPluginFunction<Options> = (eleventyConfig: EleventyConfig, options: Options) => void

interface EleventyPluginObject<Options> {
  initArguments?: Record<string, unknown>
  configFunction: EleventyPluginFunction<Options>
}

interface EleventyConfig {
  addPlugin(plugin: EleventyPlugin): void
  on(event: 'beforeWatch', handler: (changedFiles: string[]) => void): void
  on(event: 'beforeBuild' | 'afterBuild' | 'beforeWatch', handler: () => void): void
}
