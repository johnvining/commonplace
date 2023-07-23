import * as db from './Database'
import { useState } from 'react'
import React from 'react'
import { Redirect } from 'react-router-dom'

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
        <input
          onChange={(e) => {
            setPassword(e.target.value)
          }}
          type="password"
        ></input>
        <button className="top-level standard-button left-right" type="submit">
          Submit
        </button>
      </form>
    </div>
  )
}

export default Login
