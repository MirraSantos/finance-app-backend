import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const INCOME = 'INCOME'
const EXPENSE = 'EXPENSE'

const transactionSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  description: z.string().min(1, 'Descrição obrigatória'),
  date: z.string().min(1, 'Data obrigatória'),
})

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      type,
      categoryId,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '20',
    } = req.query

    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
    const skip = (pageNum - 1) * limitNum

    const where: Prisma.TransactionWhereInput = { userId: req.userId }
    if (type) where.type = type as string
    if (categoryId) where.categoryId = categoryId as string
    if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Prisma.DateTimeFilter).gte = new Date(startDate as string)
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999);
        (where.date as Prisma.DateTimeFilter).lte = end
      }
    }
    if (search) {
      where.description = { contains: search as string }
    }

    const [transactions, total, incomeAgg, expenseAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where: { ...where, type: INCOME },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: EXPENSE },
        _sum: { amount: true },
      }),
    ])

    const totalIncome = Number(incomeAgg._sum.amount || 0)
    const totalExpense = Number(expenseAgg._sum.amount || 0)

    return res.json({
      data: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    })
  } catch (err) {
    next(err)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.userId },
      include: { category: true },
    })
    if (!transaction) return res.status(404).json({ error: 'Transação não encontrada.' })
    return res.json({ data: { ...transaction, amount: Number(transaction.amount) } })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = transactionSchema.parse(req.body)
    const transaction = await prisma.transaction.create({
      data: {
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId,
        description: data.description,
        date: new Date(data.date),
        userId: req.userId,
      },
      include: { category: true },
    })
    return res.status(201).json({
      data: { ...transaction, amount: Number(transaction.amount) },
      message: 'Transação criada com sucesso!',
    })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.transaction.findFirst({ where: { id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Transação não encontrada.' })

    const data = transactionSchema.partial().parse(req.body)
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...data,
        ...(data.date !== undefined && { date: new Date(data.date) }),
      },
      include: { category: true },
    })
    return res.json({
      data: { ...transaction, amount: Number(transaction.amount) },
      message: 'Transação atualizada!',
    })
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.transaction.findFirst({ where: { id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Transação não encontrada.' })
    await prisma.transaction.delete({ where: { id } })
    return res.json({ message: 'Transação eliminada.' })
  } catch (err) {
    next(err)
  }
}
