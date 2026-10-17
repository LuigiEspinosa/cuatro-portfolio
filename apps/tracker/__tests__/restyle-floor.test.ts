import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Story 8.5: what holds the tracker's restyle floor (/login, RESTYLE-SPEC.md § The floor) in source.
// The browser measurement is ops/restyle-floor.md § cuatro-tracker; this is the part a file can show.

const APP = resolve(__dirname, '..')
const CONTRACTS = resolve(APP, '../../contracts')

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
// Comments out, so a rule's prose cannot satisfy or trip a check.
const declarations = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// R24 (2026-10-17): the tracker reads the Anchor's contracts/ directly, as apps/tournament does, and
// vendors no copy; apps/hub/app/__tests__/anchor-contract.test.ts refuses a cuatro-contracts/ folder.
describe('the token contract (AD-14, R24)', () => {
  it('is consumed through the Anchor contracts/tailwind.css adapter, first, and tailwindcss is not imported a second time', () => {
    const imports = declarations(read(join(APP, 'app/global.css'))).match(/@import\s+[^;]+;/g) ?? []
    expect(imports[0]).toBe("@import '../../../contracts/tailwind.css';")
    const target = resolve(dirname(join(APP, 'app/global.css')), '../../../contracts/tailwind.css')
    expect(target).toBe(join(CONTRACTS, 'tailwind.css'))
    expect(read(target)).toMatch(/Contract v2\.0\.0/)
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
