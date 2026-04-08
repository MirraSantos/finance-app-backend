import { Router } from 'express'
import { getAll, getById, create, update, contribute, remove } from '../controllers/goal.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', getAll)
router.get('/:id', getById)
router.post('/', create)
router.put('/:id', update)
router.post('/:id/contribute', contribute)
router.delete('/:id', remove)

export default router
