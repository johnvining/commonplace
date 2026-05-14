import User from '../user/user.model.js'
import bcrypt from 'bcryptjs'
import jwt, { type VerifyErrors, type JwtPayload } from 'jsonwebtoken'
import config from '../../config'
import type { Request, Response, NextFunction } from 'express'


// Cookie lasts 7 days, then re-login. Idle users get logged out within a
// week; active users never do thanks to the sliding refresh below.
const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60
// Refresh threshold: any authenticated request whose token is older than
// this re-issues a fresh cookie, sliding the 7-day window forward. Set
// well below TOKEN_LIFETIME_SECONDS so steady use never falls off.
const TOKEN_REFRESH_AFTER_SECONDS = 24 * 60 * 60

interface ConfigForCookies {
  isDev: boolean
}

const cookieOptions = (config: ConfigForCookies) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: !config.isDev,
  maxAge: TOKEN_LIFETIME_SECONDS * 1000,
})

// res.clearCookie writes its own expiry — `maxAge` here is meaningless and
// triggers an Express deprecation warning. Drop it, keep the rest so the
// browser can match the cookie being cleared.
const clearCookieOptions = (config: ConfigForCookies) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: !config.isDev,
})

function jwtSecret(): string {
  if (!config.secrets.jwt) throw new Error('JWT secret missing from config.secrets.jwt')
  return config.secrets.jwt
}

function signAuthCookie(res: Response, userId: unknown, username: string) {
  const token = jwt.sign({ id: userId, username }, jwtSecret(), {
    expiresIn: TOKEN_LIFETIME_SECONDS,
  })
  res.cookie('jwt', token, cookieOptions(config))
}

export const reqRegisterUser = async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (username != 'commonplace' || !password) {
    return res.status(400).json({
      message: 'Username or Password not present',
    })
  }

  // Registration is single-shot: once *any* user exists the endpoint is
  // closed. Independent of the username check above so a future regression
  // that drops it doesn't accidentally re-open the door.
  const existing = await User.countDocuments().exec()
  if (existing > 0) {
    return res.status(401).json({
      message: 'User already exists',
    })
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const user = await User.create({ username, password: hash })
    signAuthCookie(res, user._id, username)
    res.status(201).json({ message: 'User successfully created', user: user._id })
  } catch (error: any) {
    res.status(401).json({
      message: 'User not successfully created',
      error: error?.message,
    })
  }
}

export const reqAuthorizeUser = async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({
      message: 'Username or Password not present',
    })
  }

  try {
    const user = await User.findOne({ username })
    if (!user) {
      res.status(400).json({
        message: 'Login not successful',
        error: 'User not found',
      })
    } else {
      const result = await bcrypt.compare(password, user.password)
      if (result) {
        signAuthCookie(res, user._id, username)
        res.status(201).json({
          message: 'User successfully Logged in',
          user: user._id,
        })
      } else {
        res.status(400).json({ message: 'Incorrect password' })
      }
    }
  } catch (error) {
    console.error(error)
    res.status(400).json({ message: 'An error occurred' })
  }
}

export const reqAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.jwt
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token not available' })
  }
  jwt.verify(token, jwtSecret(), (err: VerifyErrors | null, decodedToken: JwtPayload | string | undefined) => {
    if (err || !decodedToken || typeof decodedToken === 'string') {
      return res.status(401).json({ message: 'Not authorized' })
    } else if (decodedToken.username != 'commonplace') {
      return res.status(401).json({ message: 'Wrong username' })
    } else {
      // Sliding refresh: if the token has been around for more than the
      // refresh threshold, re-issue. Steady use keeps the user signed in
      // indefinitely; a week of idle and the cookie expires for real.
      const issuedAt = typeof decodedToken.iat === 'number' ? decodedToken.iat : null
      const nowSeconds = Math.floor(Date.now() / 1000)
      if (issuedAt && nowSeconds - issuedAt > TOKEN_REFRESH_AFTER_SECONDS) {
        signAuthCookie(res, decodedToken.id, decodedToken.username)
      }
      next()
    }
  })
}

export const reqCheckAuth = (req: Request, res: Response) => {
  res.status(200).end()
}

export const reqLogout = (req: Request, res: Response) => {
  res.clearCookie('jwt', clearCookieOptions(config))
  res.status(200).end()
}

export const reqChangePassword = async (req: Request, res: Response) => {
  const { username, oldPassword, newPassword } = req.body
  let existingUser = await User.findOne({ username: username }).exec()
  if (
    !username ||
    !oldPassword ||
    !newPassword ||
    existingUser == null ||
    username != 'commonplace'
  ) {
    return res.status(400).json({
      message: 'Incorrect parameters',
    })
  }

  let oldPasswordIsRight = await bcrypt.compare(
    oldPassword,
    existingUser.password
  )
  if (!oldPasswordIsRight) {
    return res.status(400).json({ message: 'Error' })
  }

  let newPasswordHash = await bcrypt.hash(newPassword, 10)
  await User.findOneAndUpdate(
    { _id: existingUser._id },
    { password: newPasswordHash }
  )

  return res.status(201).json({
    message: 'User successfully updated',
  })
}
