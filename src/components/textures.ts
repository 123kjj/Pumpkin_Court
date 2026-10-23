// Procedural textures, rasterised once by the browser as images.
// Generated from SVG turbulence so there are no image files to ship.

const uri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** Noise tile: `freq` is "x y" base frequency; alpha comes from the noise's red channel. */
function noise(freq: string, octaves: number, rgb: [number, number, number], gain: number, bias: number, seed: number, size = 400) {
  const [r, g, b] = rgb
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<filter id="n" x="0" y="0" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/>` +
      `<feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${gain} 0 0 0 ${bias}"/>` +
      `</filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
  )
}

/** Dark grain streaks running vertically (wall planks, bench front). */
export const WOOD_V = noise('0.09 0.004', 4, [0.07, 0.03, 0.02], 1.9, -0.62, 11)
/** Grain running horizontally (bench top, floor, tables). */
export const WOOD_H = noise('0.004 0.09', 4, [0.07, 0.03, 0.02], 1.9, -0.62, 23)
/** Fine fibre noise for paper. */
export const PAPER = noise('0.85', 3, [0.35, 0.27, 0.16], 0.9, -0.33, 5, 300)
/** Soft mottling for velvet and pumpkin skin. */
export const MOTTLE = noise('0.035', 3, [0.2, 0.05, 0.02], 1.4, -0.5, 8, 300)
/** Speckle used to distress rubber-stamp ink. */
export const SPECKLE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="s" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 0 0 0 1.75"/></filter>` +
    `<rect width="100%" height="100%" filter="url(#s)"/></svg>`,
)

/** CSS custom properties so stylesheets can use the same textures. */
export const textureVars = {
  '--tex-wood-v': `url("${WOOD_V}")`,
  '--tex-wood-h': `url("${WOOD_H}")`,
  '--tex-paper': `url("${PAPER}")`,
  '--tex-mottle': `url("${MOTTLE}")`,
  '--tex-speckle': `url("${SPECKLE}")`,
} as React.CSSProperties
