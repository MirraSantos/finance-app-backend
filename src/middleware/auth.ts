import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token

  if (!token) {
    res.status(401).json({ error: 'Não autenticado. Por favor faça login.' })
    return
  }

  try {
    const payload = verifyToken(token)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Por favor faça login novamente.' })
  }
}
