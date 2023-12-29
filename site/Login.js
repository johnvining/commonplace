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
  const [redirect, setRedirect] = useState(false)

  const handleSubmitPassword = async (e) => {
    e.preventDefault() // Prevent navigating to new page on submit
    await db
      .getAuthentication(password)
      .then((response) => {
        const token = response.data.token
        props.onTokenReceived(token)
      })
      .catch((error) => {
        console.error(error)
      })
  }

  return (
    <div>
      <form onSubmit={handleSubmitPassword}>
        <TopLevelFormContainer>
          <TopLevelFormInput
            name="Password"
            id="password"
            onChange={(e) => {
              setPassword(e.target.value)
            }}
            type="password"
          />
          <TopLevelStandardButtonContainer>
            <TopLevelStandardButton name="Submit" type="submit" />
          </TopLevelStandardButtonContainer>
        </TopLevelFormContainer>
      </form>
    </div>
  )
}

export default Login
