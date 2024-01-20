import User from '../user/user.model.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import config from '../../config'

export const reqRegisterUser = async (req, res) => {
  const { username, password } = req.body
  if (username != 'commonplace' || !password) {
    return res.status(400).json({
      message: 'Username or Password not present',
    })
  }

  let existingUser = await User.findOne({ username: username }).exec()
  if (existingUser != null) {
    res.status(401).json({
      message: 'User already exists',
    })
    return
  }
  try {
    bcrypt.hash(password, 10).then(async (hash) => {
      await User.create({
        username,
        password: hash,
      }).then((user) => {
        const maxAge = 24 * 60 * 60
        const token = jwt.sign({ id: user._id, username }, config.secrets.jwt, {
          expiresIn: maxAge,
        })
        res.cookie('jwt', token, {
          httpOnly: true,
          maxAge: maxAge * 1000,
        })
        res.status(201).json({
          message: 'User successfully created',
          user: user._id,
        })
      })
    })
  } catch (error) {
    res.status(401).json({
      message: 'User not successfully created',
      error: error.mesage,
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
      bcrypt.compare(password, user.password).then(function (result) {
        if (result) {
          const maxAge = 24 * 60 * 60
          const token = jwt.sign(
            { id: user._id, username, role: user.role },
            config.secrets.jwt,
            {
              expiresIn: maxAge,
            }
          )
          res.cookie('jwt', token, {
            httpOnly: true,
            maxAge: maxAge * 1000,
          })
          res.status(201).json({
            message: 'User successfully Logged in',
            user: user._id,
            token: token,
          })
        } else {
          res.status(400).json({ message: 'Login not succesful' })
        }
      })
    }
  } catch (error) {
    res.status(400).json({
      message: 'An error occurred',
      error: error.message,
    })
  }
}

export const reqAuthenticate = async (req, res, next) => {
  const token = req.headers.authorization.replace('Bearer ', '')
  if (token) {
    jwt.verify(token, config.secrets.jwt, (err, decodedToken) => {
      if (err) {
        console.log(err)
        return res.status(401).json({ message: 'Not authorized' })
      } else if (decodedToken.username != 'commonplace') {
        return res.status(401).json({ message: 'Wrong username' })
      } else {
        next()
      }
    })
  } else {
    return res
      .status(401)
      .json({ message: 'Not authorized, token not available' })
  }
}
