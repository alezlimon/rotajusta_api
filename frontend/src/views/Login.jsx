import { useState } from 'react'
import { login } from '../services/authService'

const initialForm = { email: '', password: '' }

export function Login() {
  const [form, setForm] = useState(initialForm)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      await login(form.email, form.password)
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-slate-100">
      <div className="pointer-events-none absolute -left-28 top-12 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />

      <section className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/70 p-7 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">La Rota Justa</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Acceso de Manager</h1>
        <p className="mt-2 text-sm text-slate-300">Inicia sesion para validar jornadas y revisar puntos del equipo.</p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25"
              placeholder="manager@rotajusta.local"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Contrasena</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25"
              placeholder="Tu contrasena"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-300/60"
          >
            {isLoading ? 'Cargando...' : 'Iniciar sesion'}
          </button>
        </form>
      </section>
    </main>
  )
}
