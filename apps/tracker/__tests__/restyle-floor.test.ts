import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Story 8.5: what holds the tracker's restyle floor (/login, RESTYLE-SPEC.md § The floor) in source.
// The browser measurement is ops/restyle-floor.md § cuatro-tracker; this is the part a file can show.

const APP = resolve(__dirname, '..')
const CONTRACTS = resolve(APP, '../../contracts')
const VENDORED = join(APP, 'app/cuatro-contracts')
const NINE = [
  'fonts.css',
  'fonts/OFL-bricolage-grotesque.txt',
  'fonts/OFL-geist-mono.txt',
  'fonts/OFL-geist.txt',
  'fonts/bricolage-grotesque-latin.woff2',
  'fonts/geist-latin.woff2',
  'fonts/geist-mono-latin.woff2',
  'tailwind.css',
  'tokens.css',
]

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const listed = (dir: string, prefix = ''): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listed(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  )
// Comments out, so a rule's prose cannot satisfy or trip a check.
const declarations = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the vendored contract (AD-14)', () => {
  it('is the folder cuatro-contracts/, the nine token-contract files and nothing else', () => {
    expect(listed(VENDORED).sort()).toEqual(NINE)
  })

  it('equals the Anchor contracts/ file for file, so it cannot drift behind the published contract', () => {
    for (const file of NINE) {
      const ours = readFileSync(join(VENDORED, file))
      const theirs = readFileSync(join(CONTRACTS, file))
      const text = !file.endsWith('.woff2')
      expect(
        text ? ours.toString('utf8').replace(/\r\n/g, '\n') : ours,
        `${file} differs from contracts/${file}`,
      ).toEqual(text ? theirs.toString('utf8').replace(/\r\n/g, '\n') : theirs)
    }
    expect(read(join(VENDORED, 'tokens.css'))).toMatch(/Contract v2\.0\.0/)
  })

  it('is consumed through the Tailwind adapter, first, and tailwindcss is not imported a second time', () => {
    const imports = declarations(read(join(APP, 'app/global.css'))).match(/@import\s+[^;]+;/g) ?? []
    expect(imports[0]).toBe("@import './cuatro-contracts/tailwind.css';")
    expect(imports.filter((line) => /tailwindcss/.test(line))).toEqual([])
  })

  it('keeps --token-* and Tailwind --color-* apart: no custom property is declared from its own name', () => {
    for (const file of ['app/global.css', 'app/tokens.css', 'app/(auth)/login/login.css']) {
      const self = [...declarations(read(join(APP, file))).matchAll(/(--[\w-]+)\s*:\s*var\(\s*(--[\w-]+)/g)]
        .filter(([, name, used]) => name === used)
        .map(([whole]) => whole)
      expect(self, `${file} declares a custom property from itself (AD-14)`).toEqual([])
    }
  })
})

describe('the floor stylesheet, app/(auth)/login/login.css (RESTYLE-SPEC.md § The floor)', () => {
  const css = declarations(read(join(APP, 'app/(auth)/login/login.css')))
  const values = [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map(([, prop, value]) => ({
    prop,
    value: value.trim(),
  }))

  it('draws no shadow and no gradient (F-7) and states no opacity (§ 1, § 5)', () => {
    expect(values.filter(({ prop, value }) => /shadow$/.test(prop) && value !== 'none')).toEqual([])
    expect(css).not.toMatch(/gradient\(|drop-shadow|opacity\s*:/)
  })

  it('names no literal colour: every colour is a role (F-1, F-3, F-8)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|:\s*(black|white)\s*;/i)
    const colours = values.filter(({ prop }) => /(^color|background|border(-[a-z]+)?-color|^border(-bottom)?$)/.test(prop))
    for (const { prop, value } of colours) {
      expect(`${prop}: ${value}`).toMatch(/var\(--token-[a-z-]+\)|transparent|auto/)
    }
  })

  it('keeps every corner square (F-5) and never removes the outline (F-6)', () => {
    for (const { prop, value } of values.filter(({ prop }) => /radius/.test(prop))) {
      expect(`${prop}: ${value}`).toBe(`${prop}: var(--r-none)`)
    }
    expect(values.filter(({ prop }) => /^outline/.test(prop))).toEqual([])
  })

  it('transitions the Control border colour only, on the contract duration (§ 1)', () => {
    expect(values.filter(({ prop }) => prop === 'transition').map(({ value }) => value)).toEqual([
      'border-color var(--dur-micro) var(--ease-toggle)',
    ])
  })

  it('meets the target floor with --tap, never a hand-written 44px (F-10)', () => {
    expect(css).not.toMatch(/\b44px\b/)
    expect(values.filter(({ value }) => value === 'var(--tap)').length).toBeGreaterThanOrEqual(3)
  })
})
