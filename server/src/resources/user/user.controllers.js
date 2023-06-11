import User from '../user/user.model.js'
import bcrypt from 'bcryptjs'

export const reqRegisterUser = async (req, res) => {
  const { username, password } = req.body
  if (username != 'commonplace' || !password) {
    return res.status(400).json({
      message: 'Username or Password not present',
    })
  }

  try {
    bcrypt.hash(password, 10).then(async (hash) => {
      await User.create({
        username,
        password: hash,
      }).then((user) =>
        res.status(200).json({
          message: 'User successfully created',
          user,
        })
      )
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
        result
          ? res.status(200).json({
              message: 'Login successful',
              user,
            })
          : res.status(400).json({ message: 'Login not succesful' })
      })
    }
  } catch (error) {
    res.status(400).json({
      message: 'An error occurred',
      error: error.message,
    })
  }
}
