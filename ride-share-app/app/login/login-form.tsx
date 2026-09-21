'use client'

import { useActionState } from 'react'

import { requestMagicLink, type LoginState } from './actions'

const initialState: LoginState = { status: 'idle' }

export function LoginForm({ next, devBypassEnabled }: { next: string; devBypassEnabled: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialState)

  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
          Student email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          placeholder="you@students.finki.ukim.mk"
          aria-describedby={state.message ? 'email-help login-message' : 'email-help'}
          aria-invalid={state.status === 'error' || undefined}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <p id="email-help" className="text-sm leading-6 text-slate-500">
          Use your university-issued student email address.
        </p>
      </div>
      <button
        type="submit"
        name="intent"
        value="magic-link"
        disabled={pending}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Continuing…' : state.status === 'sent' ? 'Send another link' : 'Email me a sign-in link'}
      </button>
      {devBypassEnabled ? (
        <button
          type="submit"
          name="intent"
          value="dev-bypass"
          disabled={pending}
          className="w-full rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Development sign-in (no email)
        </button>
      ) : null}
      {state.message ? (
        <p
          id="login-message"
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl px-4 py-3 text-sm ${
            state.status === 'error'
              ? 'bg-rose-50 text-rose-800'
              : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

