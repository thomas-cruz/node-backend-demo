import * as process from 'process'

export default () => ({
  jwtSecretKey: process.env.JWT_ACCESS_SECRET,

  jwtResetPasswordSecret: process.env.JWT_RESET_PASSWORD_SECRET,
  jwtResetPasswordExpiresIn: process.env.JWT_RESET_PASSWORD_EXPIRES_IN,
})
