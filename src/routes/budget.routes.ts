import { Router } from 'express'
import { getAll, upsert, remove } from '../controllers/budget.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', getAll)
router.post('/', upsert)
router.delete('/:id', remove)

export default router
