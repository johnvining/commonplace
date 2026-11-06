import { describe, it, expect } from 'vitest'
import { loginErrorMessage } from '../Login'

const res = (status: number, message?: string) => ({ response: { status, data: { message } } })

describe('loginErrorMessage', () => {
  it("says a wrong password is a wrong password, not that the server's down", () => {
    expect(loginErrorMessage(res(400, 'Incorrect password'))).toBe('Incorrect password')
    expect(loginErrorMessage(res(401))).toBe('Incorrect password')
  })

  it('names the other cases', () => {
    expect(loginErrorMessage(res(429))).toMatch(/Too many tries/)
    expect(loginErrorMessage(res(502))).toMatch(/Server unavailable/)
    expect(loginErrorMessage({ message: 'Network Error' })).toMatch(/Can't reach the server/)
    expect(loginErrorMessage(res(400, 'Username or Password not present'))).toBe('Username or Password not present')
  })
})
