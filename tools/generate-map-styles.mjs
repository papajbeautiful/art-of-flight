/**
 * Generate self-contained MapLibre style JSONs from @protomaps/basemaps.
 *
 * Symbol layers (text/icons) are stripped so the styles need NO glyph or
 * sprite assets — zero network dependencies, pure vector shapes. The kiosk's
 * canvas overlay carries all flight information anyway.
 *
 * Run after changing flavors or upgrading @protomaps/basemaps:
 *   node tools/generate-map-styles.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layers, namedFlavor } from '@protomaps/basemaps';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/vendor/maplibre');

const FLAVORS = ['dark', 'black', 'grayscale'];

for (const flavor of FLAVORS) {
  const allLayers = layers('protomaps', namedFlavor(flavor), { lang: 'en' });
  const shapeLayers = allLayers.filter(l => l.type !== 'symbol');

  const style = {
    version: 8,
    name: `theARTofFLIGHT ${flavor}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles:///tiles/sydney.pmtiles',
        attribution: '© OpenStreetMap contributors, © Protomaps'
      }
    },
    layers: shapeLayers
  };

  const file = path.join(outDir, `style-${flavor}.json`);
  fs.writeFileSync(file, JSON.stringify(style));
  console.log(`wrote ${path.basename(file)} (${shapeLayers.length}/${allLayers.length} layers, symbols stripped)`);
}
