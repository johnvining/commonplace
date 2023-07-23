import * as db from './Database'
import { useState } from 'react'
import React from 'react'
import { Redirect } from 'react-router-dom'

function Login(props) {
  const [password, setPassword] = useState('')
  const [redirect, setRedirect] = useState(false)

  const handleSubmitPassword = async () => {
    db.getAuthentication(password)
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
      <input
        onChange={(e) => {
          setPassword(e.target.value)
        }}
        type="password"
      ></input>
      <button
        className="top-level standard-button left-right"
        onClick={handleSubmitPassword}
      >
        Submit
      </button>
    </div>
  )
}

export default Login
