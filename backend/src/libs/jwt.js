import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'

export const createToken = (payload) => {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) reject(err)
      else resolve(token)
    })
  })
}

export const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) reject(err)
      else resolve(decoded)
    })
  })
}