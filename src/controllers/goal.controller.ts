import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const goalSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  targetAmount: z.number().positive('Valor alvo deve ser positivo'),
  currentAmount: z.number().min(0).optional().default(0),
  deadline: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
})

const contributeSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
})

function calcPercentage(current: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function toGoalResponse(g: { currentAmount: unknown; targetAmount: unknown; [key: string]: unknown }) {
  const current = Number(g.currentAmount)
  const target = Number(g.targetAmount)
  return { ...g, currentAmount: current, targetAmount: target, percentage: calcPercentage(current, target) }
}

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ data: goals.map(toGoalResponse) })
  } catch (err) {
    next(err)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const goal = await prisma.goal.findFirst({ where: { id, userId: req.userId } })
    if (!goal) return res.status(404).json({ error: 'Objetivo não encontrado.' })
    return res.json({ data: toGoalResponse(goal) })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = goalSchema.parse(req.body)
    const goal = await prisma.goal.create({
      data: {
        name: data.name,
        description: data.description,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount ?? 0,
        deadline: data.deadline ? new Date(data.deadline) : null,
        color: data.color ?? '#6366f1',
        userId: req.userId,
      },
    })
    return res.status(201).json({ data: toGoalResponse(goal), message: 'Objetivo criado com sucesso!' })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.goal.findFirst({ where: { id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Objetivo não encontrado.' })

    const data = goalSchema.partial().parse(req.body)
    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...data,
        ...(data.deadline !== undefined && { deadline: data.deadline ? new Date(data.deadline) : null }),
      },
    })
    return res.json({ data: toGoalResponse(goal), message: 'Objetivo atualizado!' })
  } catch (err) {
    next(err)
  }
}

export async function contribute(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { amount } = contributeSchema.parse(req.body)

    const goal = await prisma.goal.findFirst({ where: { id, userId: req.userId } })
    if (!goal) return res.status(404).json({ error: 'Objetivo não encontrado.' })

    const newAmount = Math.min(Number(goal.currentAmount) + amount, Number(goal.targetAmount))
    const completed = newAmount >= Number(goal.targetAmount)

    const updated = await prisma.goal.update({
      where: { id },
      data: { currentAmount: newAmount, completed },
    })

    return res.json({
      data: toGoalResponse(updated),
      message: completed ? '🎉 Parabéns! Objetivo concluído!' : `Contribuição de €${amount} adicionada!`,
    })
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.goal.findFirst({ where: { id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Objetivo não encontrado.' })
    await prisma.goal.delete({ where: { id } })
    return res.json({ message: 'Objetivo eliminado.' })
  } catch (err) {
    next(err)
  }
}
