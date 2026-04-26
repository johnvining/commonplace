import * as db from './Database'
import { useState } from 'react'
import React from 'react'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormInput, TopLevelFormContainer } from './TopLevelFormItems'

function Login(props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmitPassword = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await db.getAuthentication(password)
      props.onTokenReceived(response.data.token)
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        setError('Incorrect password')
      } else {
        setError('Server unavailable — try again shortly')
      }
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={handleSubmitPassword} className="login-form">
        <TopLevelFormContainer>
          <TopLevelFormInput
            name="Password"
            id="password"
            onChange={(e) => {
              setPassword(e.target.value)
            }}
            type="password"
          />
          {error && <p className="login-error">{error}</p>}
          <TopLevelStandardButtonContainer>
            <TopLevelStandardButton name="Submit" type="submit" />
          </TopLevelStandardButtonContainer>
        </TopLevelFormContainer>
      </form>
    </div>
  )
}

export default Login
