import User from '../user/user.model.js'
import Session from './session.model.js'
import Setting from './setting.model.js'
import crypto from 'crypto'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'
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

const expiry = () => new Date(Date.now() + TOKEN_LIFETIME_SECONDS * 1000)

// Sign a token for a session and set it as the cookie (#375). A new
// sign-in makes a session; a sliding refresh keeps the same one and
// pushes its expiry forward.
async function signAuthCookie(res: Response, user: { _id: unknown; tokenVersion?: number }, username: string, sessionId?: string) {
  const jti = sessionId ?? crypto.randomUUID()
  if (sessionId) await Session.updateOne({ _id: jti }, { $set: { expiresAt: expiry() } })
  else await Session.create({ _id: jti, user: user._id, expiresAt: expiry() })
  const token = jwt.sign({ id: user._id, username, ver: user.tokenVersion ?? 0 }, jwtSecret(), {
    expiresIn: TOKEN_LIFETIME_SECONDS,
    jwtid: jti,
  })
  res.cookie('jwt', token, cookieOptions(config))
}

// Registration closes for good once any user has existed, recorded as a
// flag, so deleting the only user can't re-open it (#375)
const REGISTRATION_CLOSED = 'registrationClosed'
const closeRegistration = () =>
  Setting.updateOne({ _id: REGISTRATION_CLOSED }, { $set: { value: true } }, { upsert: true })

export const reqRegisterUser = async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (username != 'commonplace' || !password) {
    return res.status(400).json({
      message: 'Username or Password not present',
    })
  }

  // Registration is single-shot: closed once any user has existed (the
  // flag), or while one exists (for databases from before the flag).
  // Independent of the username check above so a future regression that
  // drops it doesn't accidentally re-open the door.
  const closed = await Setting.exists({ _id: REGISTRATION_CLOSED, value: true })
  if (closed || (await User.countDocuments().exec()) > 0) {
    await closeRegistration()
    return res.status(401).json({
      message: 'User already exists',
    })
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const user = await User.create({ username, password: hash })
    await closeRegistration()
    await signAuthCookie(res, user, username)
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
        await closeRegistration()
        await signAuthCookie(res, user, username)
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

// Express middleware. Errors go to next(): Express 4 doesn't catch a
// rejected promise from middleware, so one would leave the request hanging.
export const reqAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  authenticate(req, res, next).catch(next)
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.jwt
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token not available' })
  }
  let decodedToken: JwtPayload | string
  try {
    decodedToken = jwt.verify(token, jwtSecret())
  } catch {
    return res.status(401).json({ message: 'Not authorized' })
  }
  if (typeof decodedToken === 'string') {
    return res.status(401).json({ message: 'Not authorized' })
  }
  if (decodedToken.username != 'commonplace') {
    return res.status(401).json({ message: 'Wrong username' })
  }
  // The token's session must be live and its version current (#375)
  if (!mongoose.isValidObjectId(decodedToken.id) || typeof decodedToken.jti !== 'string') {
    return res.status(401).json({ message: 'Signed out; please log in again' })
  }
  const [session, user] = await Promise.all([
    decodedToken.jti ? Session.findById(decodedToken.jti).lean() : null,
    User.findById(decodedToken.id, { tokenVersion: 1 }).lean(),
  ])
  if (!session || session.revokedAt || session.expiresAt < new Date() || !user || (user.tokenVersion ?? 0) !== decodedToken.ver) {
    return res.status(401).json({ message: 'Signed out; please log in again' })
  }
  res.locals.session = { id: session._id, user }

  // Sliding refresh: if the token has been around for more than the
  // refresh threshold, re-issue it for the same session. Steady use keeps
  // the user signed in indefinitely; a week idle and it expires for real.
  const issuedAt = typeof decodedToken.iat === 'number' ? decodedToken.iat : null
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (issuedAt && nowSeconds - issuedAt > TOKEN_REFRESH_AFTER_SECONDS) {
    await signAuthCookie(res, user, decodedToken.username, session._id)
  }
  next()
}

export const reqCheckAuth = (req: Request, res: Response) => {
  res.status(200).end()
}

// Ends this session: its token stops working at once, wherever it is
export const reqLogout = async (req: Request, res: Response) => {
  await Session.updateOne({ _id: res.locals.session?.id }, { $set: { revokedAt: new Date() } })
  res.clearCookie('jwt', clearCookieOptions(config))
  res.status(200).end()
}

// Ends every session, this one included, by bumping the token version
export const reqLogoutEverywhere = async (req: Request, res: Response) => {
  await User.updateOne({ _id: res.locals.session?.user?._id }, { $inc: { tokenVersion: 1 } })
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

  // A new password cuts off every outstanding token; the caller gets a
  // fresh one so they stay signed in (#375)
  let newPasswordHash = await bcrypt.hash(newPassword, 10)
  const updated = await User.findOneAndUpdate(
    { _id: existingUser._id },
    { password: newPasswordHash, $inc: { tokenVersion: 1 } },
    { new: true }
  )
  if (updated) await signAuthCookie(res, updated, username)

  return res.status(201).json({
    message: 'User successfully updated',
  })
}
