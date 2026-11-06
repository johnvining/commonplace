import type { ReactNode } from 'react'

// Where the sign-in check stands: 'checking' until the server answers,
// then 'in', 'out' (it said 401) or 'unreachable' (anything else)
export type AuthState = 'checking' | 'in' | 'out' | 'unreachable'

// What to show for each: nothing while checking, so the login page never
// flashes up for someone already signed in; a retry when the server can't
// be reached, rather than sending a signed-in user to log in again
export default function AuthGate({
  auth,
  login,
  onRetry,
  children,
}: {
  auth: AuthState
  login: () => ReactNode
  onRetry: () => void
  children: ReactNode
}) {
  if (auth === 'checking') return <div className="auth-checking" />
  if (auth === 'unreachable') {
    return (
      <div className="auth-unreachable">
        <p>Can't reach the Commonplace server.</p>
        <button className="load-retry" onClick={onRetry}>Retry</button>
      </div>
    )
  }
  if (auth === 'out') return <>{login()}</>
  return <>{children}</>
}
