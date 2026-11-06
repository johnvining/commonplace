import * as db from './Database'
import { useState } from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormInput, TopLevelFormContainer } from './TopLevelFormItems'

// What went wrong signing in. The server answers a wrong password with
// 400 "Incorrect password" and too many tries with 429; only no answer
// at all, or a server error, means it's unavailable.
export function loginErrorMessage(err: any): string {
  const status = err?.response?.status
  const said = err?.response?.data?.message
  if (!status) return 'Can\'t reach the server — check your connection and try again'
  if (status >= 500) return `Server unavailable — try again shortly (${status})`
  if (status === 429) return 'Too many tries — wait a minute and try again'
  if (status === 400 || status === 401 || status === 403) {
    return said === 'Incorrect password' || status !== 400 ? 'Incorrect password' : said || 'Could not sign in'
  }
  return said || `Could not sign in (${status})`
}

function Login(props: any) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmitPassword = async (e: any) => {
    e.preventDefault()
    setError('')
    try {
      const response = await db.getAuthentication(password)
      props.onTokenReceived(response.data.token)
    } catch (err: any) {
      setError(loginErrorMessage(err))
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={handleSubmitPassword} className="login-form">
        <TopLevelFormContainer>
          <TopLevelFormInput
            name="Password"
            id="password"
            onChange={(e: any) => {
              setPassword(e.target.value)
            }}
            type="password"
          />
          {error && <p className="login-error">{error}</p>}
          <TopLevelStandardButtonContainer>
            <TopLevelStandardButton name="Submit" shortcut="Enter" type="submit" />
          </TopLevelStandardButtonContainer>
        </TopLevelFormContainer>
      </form>
    </div>
  )
}

export default Login
