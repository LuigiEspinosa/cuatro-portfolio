'use client'

import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { TerminalInput } from '@/components/atoms/TerminalInput'
import { BootSequence } from '@/components/molecules/BootSequence'

export type LoginCRTPhase = 'idle' | 'pending' | 'success' | 'error-truncating'

export type LoginCRTProps = {
  onSubmit: (data: { email: string; password: string }) => Promise<void> | void
  error?: string | null
  pending?: boolean
  phase?: LoginCRTPhase
  onBootComplete?: () => void
  onBootTruncate?: () => void
  channelFlipOverlay?: ReactNode
  defaultEmail?: string
  reducedMotionOverride?: boolean
}

const ERROR_BANNER_PRIMARY = '> ACCESS DENIED'
const ERROR_BANNER_SECONDARY = 'INVALID EMAIL OR PASSWORD'

export function LoginCRT({
  onSubmit,
  error,
  pending = false,
  phase = 'idle',
  onBootComplete,
  onBootTruncate,
  channelFlipOverlay,
  defaultEmail = 'admin@tracker.local',
  reducedMotionOverride,
}: LoginCRTProps) {
  const isBusy = phase !== 'idle' || pending
  const showBoot = phase === 'pending' || phase === 'success' || phase === 'error-truncating'
  const isTruncating = phase === 'error-truncating'
  const formClass = isBusy ? 'lc-form lc-form-faded' : 'lc-form'
  const screenClass = isTruncating ? 'lc-screen lc-screen-shake' : 'lc-screen'

  const passwordRef = useRef<HTMLInputElement | null>(null)
  const prevErrorRef = useRef<string | null | undefined>(error)

  useEffect(() => {
    if (!error) {
      prevErrorRef.current = error
      return
    }
    if (prevErrorRef.current === error) return
    prevErrorRef.current = error
    if (phase === 'idle') {
      passwordRef.current?.focus()
    }
  }, [error, phase])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isBusy) return
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    void onSubmit({ email, password })
  }

  // Story 8.5: the CRT cabinet, the bitmap face and the decorative block glyphs retire (RESTYLE-SPEC.md,
  // the governing decision). The same elements in the same order, as plain markup that
  // app/(auth)/login/login.css styles; the shared atoms they replace stay unchanged for the interior.
  return (
    <div className='lc-panel'>
      <div className={screenClass}>
        <header className='lc-header'>
          <span className='lc-wordmark'>CUATRO TRACKER</span>
        </header>

        <div className='lc-label'>VERSION 0.2.0</div>
        <div className='lc-label'>
          (C) CUATRO DEVELOPMENT STUDIO, 2026. ALL RIGHTS RESERVED.
        </div>

        <form className={formClass} onSubmit={handleSubmit} noValidate>
          <TerminalInput
            name='email'
            type='email'
            label='EMAIL'
            required
            autoComplete='email'
            defaultValue={defaultEmail}
            reducedMotionOverride={reducedMotionOverride}
          />
          <TerminalInput
            ref={passwordRef}
            name='password'
            type='password'
            label='PASSWORD'
            required
            autoComplete='current-password'
            reducedMotionOverride={reducedMotionOverride}
          />
          {error && phase === 'idle' ? (
            <div className='lc-alert' data-variant='error' role='alert'>
              <p className='lc-alert-primary'>{ERROR_BANNER_PRIMARY}</p>
              <p className='lc-alert-secondary'>{ERROR_BANNER_SECONDARY}</p>
            </div>
          ) : null}
          <button type='submit' disabled={isBusy} className='lc-submit'>
            {'> LOG IN'}
          </button>
        </form>
      </div>
      {showBoot ? (
        <BootSequence
          onComplete={onBootComplete ?? (() => undefined)}
          onTruncate={onBootTruncate ?? (() => undefined)}
          holdAtFrame={9}
          holdReleased={phase === 'success'}
          truncate={isTruncating}
          reducedMotionOverride={reducedMotionOverride}
        />
      ) : null}
      {channelFlipOverlay}
    </div>
  )
}
