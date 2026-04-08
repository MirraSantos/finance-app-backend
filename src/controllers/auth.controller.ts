import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { signToken, setTokenCookie, clearTokenCookie } from '../utils/jwt'

const prisma = new PrismaClient()

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Password deve ter pelo menos 8 caracteres'),
})

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password obrigatória'),
})

// Omit password from user object for safe responses
function safeUser(user: { id: string; email: string; name: string; createdAt: Date; password?: string }) {
  const { password, ...safe } = user
  return safe
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Este email já está registado.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    })

    const token = signToken(user.id)
    setTokenCookie(res, token)

    return res.status(201).json({ data: safeUser(user), message: 'Conta criada com sucesso!' })
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Email ou password incorretos.' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Email ou password incorretos.' })
    }

    const token = signToken(user.id)
    setTokenCookie(res, token)

    return res.json({ data: safeUser(user), message: 'Login efetuado com sucesso!' })
  } catch (err) {
    next(err)
  }
}

export async function logout(req: Request, res: Response) {
  clearTokenCookie(res)
  return res.json({ message: 'Sessão terminada com sucesso.' })
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' })
    }
    return res.json({ data: user })
  } catch (err) {
    next(err)
  }
}
