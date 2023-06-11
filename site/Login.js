import * as db from './Database'
import { useState } from 'react'
import React from 'react'
import axios from 'axios'

function Login(props) {
  const [password, setPassword] = useState('')

  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `${token}`
    } else delete axios.defaults.headers.common['Authorization']
  }

  const handleSubmitPassword = async () => {
    db.getAuthentication(password)
      .then((response) => {
        console.log(response)
        const token = response.data.token
        localStorage.setItem('token', token)
        axios.defaults.headers.common['Authorization'] = `${token}`
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
