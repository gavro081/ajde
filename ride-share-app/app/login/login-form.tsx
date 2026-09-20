'use client'

import { useActionState } from 'react'

import { requestMagicLink, type LoginState } from './actions'

const initialState: LoginState = { status: 'idle' }

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialState)

  return (
    <form action={action} className="space-y-5">
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
          aria-describedby="email-help login-message"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <p id="email-help" className="text-sm leading-6 text-slate-500">
          Access is limited to configured university domains.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Sending link…' : 'Email me a sign-in link'}
      </button>
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

