import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Dados inválidos',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    })
    return
  }

  // Prisma errors
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const prismaErr = err as { code: string; meta?: { target?: string[] } }
    if (prismaErr.code === 'P2002') {
      res.status(409).json({ error: 'Registo duplicado. Este valor já existe.' })
      return
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({ error: 'Registo não encontrado.' })
      return
    }
  }

  // Generic error
  if (err instanceof Error) {
    console.error('Unhandled error:', err.message)
    res.status(500).json({ error: err.message || 'Erro interno do servidor' })
    return
  }

  res.status(500).json({ error: 'Erro interno do servidor' })
}
