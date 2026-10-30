import mongoose from 'mongoose'

// Rechaza con 400 los ids que no son ObjectId válidos (antes terminaban en CastError → 500)
export const validateId = (param = 'id') => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) {
    return res.status(400).json({ message: 'Identificador inválido' })
  }
  next()
}
