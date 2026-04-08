import { Router } from 'express'
import { monthly, annual, exportData } from '../controllers/report.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/monthly', monthly)
router.get('/annual', annual)
router.get('/export', exportData)

export default router
