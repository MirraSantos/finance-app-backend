import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient, TransactionType } from '@prisma/client'

const prisma = new PrismaClient()

const categorySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (ex: #ff0000)'),
  icon: z.string().min(1, 'Ícone obrigatório'),
  type: z.nativeEnum(TransactionType),
})

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [{ isDefault: true }, { userId: req.userId }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
    return res.json({ data: categories })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = categorySchema.parse(req.body)
    const category = await prisma.category.create({
      data: { ...data, userId: req.userId, isDefault: false },
    })
    return res.status(201).json({ data: category, message: 'Categoria criada com sucesso!' })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Categoria não encontrada ou não tem permissão para editá-la.' })
    }
    const data = categorySchema.partial().parse(req.body)
    const category = await prisma.category.update({ where: { id }, data })
    return res.json({ data: category, message: 'Categoria atualizada!' })
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const existing = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Categoria não encontrada ou não tem permissão.' })
    }
    const txCount = await prisma.transaction.count({ where: { categoryId: id, userId: req.userId } })
    if (txCount > 0) {
      return res.status(409).json({ error: `Não é possível eliminar: existem ${txCount} transações nesta categoria.` })
    }
    await prisma.category.delete({ where: { id } })
    return res.json({ message: 'Categoria eliminada.' })
  } catch (err) {
    next(err)
  }
}
