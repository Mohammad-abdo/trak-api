import express from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  scheduleRide,
  getUpcomingRides,
  cancelScheduledRide
} from '../controllers/scheduledRideController.js'

const router = express.Router()

// All routes require authentication
router.post('/schedule', authenticate, scheduleRide)
router.get('/upcoming', authenticate, getUpcomingRides)
router.post('/:id/cancel', authenticate, cancelScheduledRide)

export default router

