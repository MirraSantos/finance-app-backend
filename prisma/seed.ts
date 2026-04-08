import { PrismaClient } from '@prisma/client'

const TransactionType = { INCOME: 'INCOME', EXPENSE: 'EXPENSE' } as const
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const defaultCategories = [
  // INCOME
  { name: 'Salário', color: '#22c55e', icon: 'wallet', type: TransactionType.INCOME },
  { name: 'Freelance', color: '#3b82f6', icon: 'briefcase', type: TransactionType.INCOME },
  { name: 'Investimentos', color: '#a855f7', icon: 'trending-up', type: TransactionType.INCOME },
  { name: 'Outros Rendimentos', color: '#f59e0b', icon: 'plus-circle', type: TransactionType.INCOME },
  // EXPENSE
  { name: 'Alimentação', color: '#ef4444', icon: 'shopping-cart', type: TransactionType.EXPENSE },
  { name: 'Transporte', color: '#f97316', icon: 'car', type: TransactionType.EXPENSE },
  { name: 'Habitação', color: '#8b5cf6', icon: 'home', type: TransactionType.EXPENSE },
  { name: 'Saúde', color: '#ec4899', icon: 'heart', type: TransactionType.EXPENSE },
  { name: 'Lazer', color: '#06b6d4', icon: 'smile', type: TransactionType.EXPENSE },
  { name: 'Educação', color: '#84cc16', icon: 'book', type: TransactionType.EXPENSE },
  { name: 'Vestuário', color: '#f59e0b', icon: 'shirt', type: TransactionType.EXPENSE },
  { name: 'Tecnologia', color: '#3b82f6', icon: 'smartphone', type: TransactionType.EXPENSE },
  { name: 'Outros', color: '#6b7280', icon: 'more-horizontal', type: TransactionType.EXPENSE },
]

async function main() {
  console.log('🌱 Seeding database...')

  // Create default categories
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { id: `default-${cat.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `default-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
        ...cat,
        isDefault: true,
        userId: null,
      },
    })
  }
  console.log(`✅ Created ${defaultCategories.length} default categories`)

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo1234', 10)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@finance.app' },
    update: {},
    create: {
      email: 'demo@finance.app',
      name: 'Utilizador Demo',
      password: hashedPassword,
    },
  })
  console.log(`✅ Demo user: demo@finance.app / demo1234`)

  // Seed some demo transactions for the current month
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const salarioId = `default-salário`
  const alimentacaoId = `default-alimentação`
  const transporteId = `default-transporte`
  const habitacaoId = `default-habitação`
  const lazerID = `default-lazer`

  const demoTransactions = [
    { amount: 1800, type: TransactionType.INCOME, categoryId: salarioId, description: 'Salário Março', date: new Date(year, month, 1) },
    { amount: 250, type: TransactionType.EXPENSE, categoryId: alimentacaoId, description: 'Supermercado Continente', date: new Date(year, month, 3) },
    { amount: 45, type: TransactionType.EXPENSE, categoryId: transporteId, description: 'Carregamento passe mensal', date: new Date(year, month, 5) },
    { amount: 650, type: TransactionType.EXPENSE, categoryId: habitacaoId, description: 'Renda apartamento', date: new Date(year, month, 7) },
    { amount: 80, type: TransactionType.EXPENSE, categoryId: lazerID, description: 'Cinema + jantar', date: new Date(year, month, 10) },
    { amount: 500, type: TransactionType.INCOME, categoryId: `default-freelance`, description: 'Projeto website', date: new Date(year, month, 12) },
    { amount: 35, type: TransactionType.EXPENSE, categoryId: alimentacaoId, description: 'Restaurante almoço', date: new Date(year, month, 14) },
    { amount: 120, type: TransactionType.EXPENSE, categoryId: `default-saúde`, description: 'Consulta médica', date: new Date(year, month, 16) },
  ]

  for (const tx of demoTransactions) {
    await prisma.transaction.create({
      data: { ...tx, userId: demoUser.id },
    })
  }
  console.log(`✅ Created ${demoTransactions.length} demo transactions`)

  // Demo budgets
  const demoBudgets = [
    { categoryId: alimentacaoId, amount: 400, month: month + 1, year },
    { categoryId: transporteId, amount: 100, month: month + 1, year },
    { categoryId: habitacaoId, amount: 700, month: month + 1, year },
    { categoryId: lazerID, amount: 150, month: month + 1, year },
  ]

  for (const budget of demoBudgets) {
    const { categoryId, amount, month: m, year: y } = budget
    await prisma.budget.upsert({
      where: { userId_categoryId_month_year: { userId: demoUser.id, categoryId, month: m, year: y } },
      update: { amount },
      create: { userId: demoUser.id, categoryId, amount, month: m, year: y },
    })
  }
  console.log(`✅ Created ${demoBudgets.length} demo budgets`)

  // Demo goal
  await prisma.goal.create({
    data: {
      userId: demoUser.id,
      name: 'Fundo de Emergência',
      description: '3 meses de despesas guardados',
      targetAmount: 5000,
      currentAmount: 1200,
      color: '#6366f1',
      deadline: new Date(year + 1, 0, 1),
    },
  })
  console.log(`✅ Created demo goal`)

  console.log('\n🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
