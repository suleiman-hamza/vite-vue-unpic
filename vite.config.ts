import type { ResolvedConfig } from 'vite'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPixels } from '@unpic/pixels'
import { blurhashToDataUri } from '@unpic/placeholder'
import vue from '@vitejs/plugin-vue'
import { encode } from 'blurhash'
import { defineConfig } from 'vite'
import inspect from 'vite-plugin-inspect'
import { MagicString } from 'vue/compiler-sfc'

export default defineConfig({
  plugins: [
    inspect(),
    vue(),
    (() => {
      let resolvedConfig: ResolvedConfig

      const imgTagRegex = /<img\s[^>]*src=["']([^"']+)["'][^>]*>/g

      return {
        name: 'unpic',
        enforce: 'pre',
        transform: {
          filter: {
            id: /\.vue$/,
            code: imgTagRegex,
          },
          async handler(code) {
            const s = new MagicString(code)

            let match = imgTagRegex.exec(code)

            if (!match) {
              return {
                code,
                map: null,
              }
            }

            do {
              const srcValue = match[1]

              const img = await readFile(join(resolvedConfig.publicDir, srcValue))
              const data = await getPixels(img)
              const blurhash = encode(Uint8ClampedArray.from(data.data), data.width, data.height, 4, 4)

              const imgTagStart = match.index
              const imgTagEnd = imgTagStart + match[0].length

              const newImgTag = match[0].replace(
                /<img(\s+)/,
                `<img$1width="${data.width}" height="${data.height}" style="background-size: cover; background-image: url(${blurhashToDataUri(blurhash)});" loading="lazy" `,
              )

              s.overwrite(imgTagStart, imgTagEnd, newImgTag)

              match = imgTagRegex.exec(code)
            } while (match !== null)

            return {
              code: s.toString(),
              map: s.generateMap({ hires: true }),
            }
          },
        },
        configResolved(config) {
          resolvedConfig = config
        },
      }
    })(),
  ],
})
