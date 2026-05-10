import User from '../user/user.model.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import config from '../../config'

const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60

const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: !config.isDev,
  maxAge: TOKEN_LIFETIME_SECONDS * 1000,
})

export const reqRegisterUser = async (req, res) => {
  const { username, password } = req.body
  if (username != 'commonplace' || !password) {
    return res.status(400).json({
      message: 'Username or Password not present',
    })
  }

  let existingUser = await User.findOne({ username: username }).exec()
  if (existingUser != null) {
    return res.status(401).json({
      message: 'User already exists',
    })
  }

  try {
    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, password: hash })
    const token = jwt.sign({ id: user._id, username }, config.secrets.jwt, {
      expiresIn: TOKEN_LIFETIME_SECONDS,
    })
    res.cookie('jwt', token, cookieOptions(config))
    res.status(201).json({ message: 'User successfully created', user: user._id })
  } catch (error) {
    res.status(401).json({
      message: 'User not successfully created',
      error: error.message,
    })
  }
}

export const reqAuthorizeUser = async (req, res) => {
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
        const token = jwt.sign(
          { id: user._id, username, role: (user as any).role },
          config.secrets.jwt,
          { expiresIn: TOKEN_LIFETIME_SECONDS }
        )
        res.cookie('jwt', token, cookieOptions(config))
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

export const reqAuthenticate = async (req, res, next) => {
  const token = req.cookies.jwt
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token not available' })
  }
  jwt.verify(token, config.secrets.jwt, (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ message: 'Not authorized' })
    } else if (decodedToken.username != 'commonplace') {
      return res.status(401).json({ message: 'Wrong username' })
    } else {
      next()
    }
  })
}

export const reqCheckAuth = (req, res) => {
  res.status(200).end()
}

export const reqLogout = (req, res) => {
  res.clearCookie('jwt', cookieOptions(config))
  res.status(200).end()
}

export const reqChangePassword = async (req, res) => {
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
