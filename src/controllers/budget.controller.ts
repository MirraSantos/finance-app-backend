import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EXPENSE = 'EXPENSE'

const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
})

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.query
    const m = month ? parseInt(month as string) : new Date().getMonth() + 1
    const y = year ? parseInt(year as string) : new Date().getFullYear()

    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId, month: m, year: y },
      include: { category: true },
    })

    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const startDate = new Date(y, m - 1, 1)
        const endDate = new Date(y, m, 0, 23, 59, 59)

        const spent = await prisma.transaction.aggregate({
          where: {
            userId: req.userId,
            categoryId: budget.categoryId,
            type: EXPENSE,
            date: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        })

        const spentAmount = Number(spent._sum.amount || 0)
        const budgetAmount = Number(budget.amount)

        return {
          ...budget,
          amount: budgetAmount,
          spent: spentAmount,
          percentage: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0,
        }
      })
    )

    return res.json({ data: budgetsWithSpent })
  } catch (err) {
    next(err)
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction) {
  try {
    const { categoryId, amount, month, year } = budgetSchema.parse(req.body)

    const budget = await prisma.budget.upsert({
      where: { userId_categoryId_month_year: { userId: req.userId, categoryId, month, year } },
      update: { amount },
      create: { userId: req.userId, categoryId, amount, month, year },
      include: { category: true },
    })

    return res.json({ data: { ...budget, amount: Number(budget.amount) }, message: 'Orçamento guardado!' })
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.budget.findFirst({ where: { id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado.' })
    await prisma.budget.delete({ where: { id } })
    return res.json({ message: 'Orçamento eliminado.' })
  } catch (err) {
    next(err)
  }
}
