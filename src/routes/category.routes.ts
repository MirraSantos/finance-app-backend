import { Router } from 'express'
import { getAll, create, update, remove } from '../controllers/category.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
