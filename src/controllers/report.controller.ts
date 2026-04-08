import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const INCOME = 'INCOME'
const EXPENSE = 'EXPENSE'

export async function monthly(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear()

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)
    const prevStartDate = new Date(year, month - 2, 1)
    const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59)

    const [transactions, prevIncome, prevExpense] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.userId, date: { gte: startDate, lte: endDate } },
        include: { category: true },
        orderBy: { date: 'asc' },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: INCOME, date: { gte: prevStartDate, lte: prevEndDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: EXPENSE, date: { gte: prevStartDate, lte: prevEndDate } },
        _sum: { amount: true },
      }),
    ])

    let totalIncome = 0
    let totalExpense = 0
    const categoryMap: Record<string, { categoryId: string; categoryName: string; color: string; amount: number }> = {}
    const dailyMap: Record<string, { income: number; expense: number }> = {}

    for (const tx of transactions) {
      const amt = Number(tx.amount)
      const dateKey = tx.date.toISOString().split('T')[0]

      if (!dailyMap[dateKey]) dailyMap[dateKey] = { income: 0, expense: 0 }

      if (tx.type === INCOME) {
        totalIncome += amt
        dailyMap[dateKey].income += amt
      } else {
        totalExpense += amt
        dailyMap[dateKey].expense += amt
        if (!categoryMap[tx.categoryId]) {
          categoryMap[tx.categoryId] = {
            categoryId: tx.categoryId,
            categoryName: tx.category.name,
            color: tx.category.color,
            amount: 0,
          }
        }
        categoryMap[tx.categoryId].amount += amt
      }
    }

    const dailyEvolution = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values, balance: values.income - values.expense }))

    const byCategory = Object.values(categoryMap)
      .map((c) => ({
        ...c,
        percentage: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    const prevTotalIncome = Number(prevIncome._sum.amount || 0)
    const prevTotalExpense = Number(prevExpense._sum.amount || 0)

    return res.json({
      data: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        byCategory,
        dailyEvolution,
        previousMonth: {
          totalIncome: prevTotalIncome,
          totalExpense: prevTotalExpense,
          balance: prevTotalIncome - prevTotalExpense,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function annual(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId, date: { gte: startDate, lte: endDate } },
      include: { category: true },
    })

    const months: { month: number; income: number; expense: number; balance: number }[] = Array.from(
      { length: 12 },
      (_, i) => ({ month: i + 1, income: 0, expense: 0, balance: 0 })
    )

    const categoryMap: Record<string, { categoryName: string; color: string; amount: number }> = {}

    for (const tx of transactions) {
      const m = tx.date.getMonth()
      const amt = Number(tx.amount)
      if (tx.type === INCOME) {
        months[m].income += amt
      } else {
        months[m].expense += amt
        if (!categoryMap[tx.categoryId]) {
          categoryMap[tx.categoryId] = { categoryName: tx.category.name, color: tx.category.color, amount: 0 }
        }
        categoryMap[tx.categoryId].amount += amt
      }
    }

    months.forEach((m) => { m.balance = m.income - m.expense })

    const totalIncome = months.reduce((s, m) => s + m.income, 0)
    const totalExpense = months.reduce((s, m) => s + m.expense, 0)
    const bestMonth = months.reduce((best, m) => (m.balance > best.balance ? m : best), months[0])
    const worstMonth = months.reduce((worst, m) => (m.balance < worst.balance ? m : worst), months[0])

    return res.json({
      data: {
        year,
        months,
        totalIncome,
        totalExpense,
        totalBalance: totalIncome - totalExpense,
        bestMonth: { month: bestMonth.month, balance: bestMonth.balance },
        worstMonth: { month: worstMonth.month, balance: worstMonth.balance },
        byCategory: Object.values(categoryMap).sort((a, b) => b.amount - a.amount),
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function exportData(req: Request, res: Response, next: NextFunction) {
  try {
    const { format = 'csv', startDate, endDate } = req.query

    const where: Record<string, unknown> = { userId: req.userId }
    if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate as string)
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999);
        (where.date as Record<string, unknown>).lte = end
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
    })

    if (format === 'csv') {
      const headers = 'Data,Tipo,Categoria,Descrição,Valor\n'
      const rows = transactions
        .map((tx) => {
          const date = tx.date.toISOString().split('T')[0]
          const type = tx.type === INCOME ? 'Receita' : 'Despesa'
          const amount = Number(tx.amount).toFixed(2)
          return `${date},${type},${tx.category.name},"${tx.description}",${amount}`
        })
        .join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="transacoes.csv"')
      return res.send(headers + rows)
    }

    return res.json({
      data: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString().split('T')[0],
        type: tx.type,
        category: tx.category.name,
        description: tx.description,
        amount: Number(tx.amount),
      })),
    })
  } catch (err) {
    next(err)
  }
}
