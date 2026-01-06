/**
 * Scheduled Ride Controller
 * 
 * Handles prepaid scheduled ride operations:
 * - Schedule a ride with upfront payment
 * - Get upcoming scheduled rides
 * - Cancel scheduled rides with refund logic
 */

import prisma from '../utils/prisma.js'
import { sendNotificationToUsers, saveNotification } from '../utils/notificationService.js'

/**
 * @desc    Schedule a prepaid ride
 * @route   POST /api/rides/schedule
 * @access  Private
 */
export const scheduleRide = async (req, res) => {
  try {
    const {
      serviceId,
      scheduleDatetime,
      startLatitude,
      startLongitude,
      startAddress,
      endLatitude,
      endLongitude,
      endAddress,
      paymentType,
      paymentGateway,
      transactionId,
      paymentReference,
      distance,
      duration,
      couponCode,
      extraCharges
    } = req.body

    const userId = req.user.id

    // Validation
    if (!scheduleDatetime || !startAddress || !endAddress) {
      return res.status(400).json({
        success: false,
        message: 'Schedule datetime, start address, and end address are required'
      })
    }

    // Validate scheduled date is in the future
    const scheduledDate = new Date(scheduleDatetime)
    const now = new Date()
    
    if (scheduledDate <= now) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled datetime must be in the future'
      })
    }

    // Validate minimum advance booking time (e.g., 30 minutes)
    const minAdvanceTime = 30 * 60 * 1000 // 30 minutes in milliseconds
    if (scheduledDate.getTime() - now.getTime() < minAdvanceTime) {
      return res.status(400).json({
        success: false,
        message: 'Ride must be scheduled at least 30 minutes in advance'
      })
    }

    // Get service to calculate fare
    let service = null
    if (serviceId) {
      service = await prisma.service.findUnique({
        where: { id: parseInt(serviceId) }
      })

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        })
      }
    }

    // Calculate fare
    const fareCalculation = await calculateFare({
      service,
      distance: distance ? parseFloat(distance) : null,
      duration: duration ? parseFloat(duration) : null,
      couponCode,
      extraCharges
    })

    // Payment must be completed before creating ride
    if (!paymentReference && !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Payment must be completed before scheduling ride. Payment reference or transaction ID is required.'
      })
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create the scheduled ride
      const ride = await tx.rideRequest.create({
        data: {
          riderId: userId,
          serviceId: serviceId ? parseInt(serviceId) : null,
          isSchedule: true,
          isPrepaid: true,
          scheduleDatetime: scheduledDate,
          datetime: scheduledDate,
          status: 'scheduled', // New status for scheduled rides
          startLatitude: startLatitude?.toString(),
          startLongitude: startLongitude?.toString(),
          startAddress,
          endLatitude: endLatitude?.toString(),
          endLongitude: endLongitude?.toString(),
          endAddress,
          distance: fareCalculation.distance,
          duration: fareCalculation.duration,
          totalAmount: fareCalculation.totalAmount,
          subtotal: fareCalculation.subtotal,
          baseFare: fareCalculation.baseFare,
          minimumFare: fareCalculation.minimumFare,
          perDistance: fareCalculation.perDistance,
          perDistanceCharge: fareCalculation.perDistanceCharge,
          perMinuteDrive: fareCalculation.perMinuteDrive,
          perMinuteDriveCharge: fareCalculation.perMinuteDriveCharge,
          extraChargesAmount: fareCalculation.extraChargesAmount,
          extraCharges: extraCharges ? JSON.parse(JSON.stringify(extraCharges)) : null,
          couponDiscount: fareCalculation.couponDiscount,
          couponCode: fareCalculation.couponCode,
          paymentType: paymentType || 'card',
          paymentReference,
          serviceData: service ? JSON.parse(JSON.stringify(service)) : null
        }
      })

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          rideRequestId: ride.id,
          userId: userId,
          driverId: 0, // Will be updated when driver is assigned
          amount: fareCalculation.totalAmount,
          paymentType: paymentType || 'card',
          paymentStatus: 'paid',
          paymentGateway: paymentGateway || 'stripe',
          transactionId: transactionId || paymentReference
        }
      })

      // If wallet payment, deduct from wallet
      if (paymentType === 'wallet') {
        const wallet = await tx.wallet.findUnique({
          where: { userId }
        })

        if (!wallet || wallet.balance < fareCalculation.totalAmount) {
          throw new Error('Insufficient wallet balance')
        }

        const newBalance = wallet.balance - fareCalculation.totalAmount

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance }
        })

        await tx.walletHistory.create({
          data: {
            walletId: wallet.id,
            userId,
            type: 'debit',
            amount: fareCalculation.totalAmount,
            balance: newBalance,
            description: 'Prepaid scheduled ride payment',
            transactionType: 'ride_payment',
            rideRequestId: ride.id
          }
        })
      }

      return { ride, payment }
    })

    // Send notification
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, playerId: true, fcmToken: true }
      })

      if (user) {
        await sendNotificationToUsers(
          [user],
          'Ride Scheduled',
          `Your ride has been scheduled for ${scheduledDate.toLocaleString()}. Payment confirmed.`,
          {
            rideId: result.ride.id,
            scheduledAt: scheduledDate.toISOString(),
            type: 'ride_scheduled'
          }
        )

        await saveNotification(
          userId,
          'ride_scheduled',
          {
            rideId: result.ride.id,
            scheduledAt: scheduledDate.toISOString()
          }
        )
      }

      // Socket.IO notification
      const io = global.io
      if (io) {
        io.to(`user-${userId}`).emit('ride_scheduled', {
          rideId: result.ride.id,
          scheduledAt: scheduledDate.toISOString(),
          status: 'scheduled'
        })
      }
    } catch (notifError) {
      console.error('Error sending notification:', notifError)
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Ride scheduled successfully',
      data: {
        ride: result.ride,
        payment: result.payment
      }
    })
  } catch (error) {
    console.error('Schedule ride error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to schedule ride'
    })
  }
}

/**
 * @desc    Get upcoming scheduled rides for authenticated user
 * @route   GET /api/rides/upcoming
 * @access  Private
 */
export const getUpcomingRides = async (req, res) => {
  try {
    const userId = req.user.id
    const { status, limit = 50, all = false } = req.query

    // If admin and all=true, show all scheduled rides. Otherwise, show only user's rides
    const where = {
      isSchedule: true
    }

    // For admin dashboard, show both prepaid and non-prepaid scheduled rides
    // For regular users, show only their prepaid scheduled rides
    if (req.user.userType === 'admin' && all === 'true') {
      // Admin can see all scheduled rides (both prepaid and non-prepaid)
    } else {
      // Regular users see only their prepaid scheduled rides
      where.isPrepaid = true
      where.riderId = userId
    }

    if (status) {
      where.status = status
    } else {
      // Default: get scheduled and active rides
      where.status = {
        in: ['scheduled', 'active']
      }
    }

    const rides = await prisma.rideRequest.findMany({
      where,
      include: {
        service: true,
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            contactNumber: true,
            latitude: true,
            longitude: true
          }
        },
        payments: {
          where: {
            paymentStatus: 'paid'
          },
          take: 1
        }
      },
      orderBy: {
        scheduleDatetime: 'asc'
      },
      take: parseInt(limit)
    })

    res.json({
      success: true,
      data: rides,
      count: rides.length
    })
  } catch (error) {
    console.error('Get upcoming rides error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch upcoming rides'
    })
  }
}

/**
 * @desc    Cancel a scheduled ride
 * @route   POST /api/rides/:id/cancel
 * @access  Private
 */
export const cancelScheduledRide = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { reason } = req.body

    // Find the ride
    const ride = await prisma.rideRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        payments: {
          where: {
            paymentStatus: 'paid'
          }
        }
      }
    })

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      })
    }

    // Verify ownership
    if (ride.riderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this ride'
      })
    }

    // Check if ride can be cancelled
    if (!ride.isSchedule || !ride.isPrepaid) {
      return res.status(400).json({
        success: false,
        message: 'This ride cannot be cancelled through this endpoint'
      })
    }

    if (ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed ride'
      })
    }

    if (ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Ride is already cancelled'
      })
    }

    // Check if ride is already active (can't cancel active rides)
    if (ride.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an active ride. Please contact support.'
      })
    }

    // Calculate refund amount based on cancellation policy
    const refundAmount = calculateRefundAmount(ride)

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update ride status
      const updatedRide = await tx.rideRequest.update({
        where: { id: parseInt(id) },
        data: {
          status: 'cancelled',
          cancelBy: 'rider',
          reason: reason || 'Cancelled by user'
        }
      })

      // Process refund if applicable
      if (refundAmount > 0 && ride.payments.length > 0) {
        const payment = ride.payments[0]

        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: 'refunded'
          }
        })

        // Refund to wallet or payment gateway
        if (payment.paymentType === 'wallet') {
          // Refund to wallet
          const wallet = await tx.wallet.findUnique({
            where: { userId }
          })

          if (wallet) {
            const newBalance = wallet.balance + refundAmount

            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: newBalance }
            })

            await tx.walletHistory.create({
              data: {
                walletId: wallet.id,
                userId,
                type: 'credit',
                amount: refundAmount,
                balance: newBalance,
                description: `Refund for cancelled scheduled ride #${ride.id}`,
                transactionType: 'refund',
                rideRequestId: ride.id
              }
            })
          }
        } else {
          // For card payments, mark for refund processing
          // In production, this would call payment gateway API
          console.log(`Refund ${refundAmount} to payment gateway for payment ${payment.id}`)
        }
      }

      return { updatedRide, refundAmount }
    })

    // Send notification
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, playerId: true, fcmToken: true }
      })

      if (user) {
        await sendNotificationToUsers(
          [user],
          'Ride Cancelled',
          `Your scheduled ride has been cancelled. ${refundAmount > 0 ? `Refund of ${refundAmount} will be processed.` : ''}`,
          {
            rideId: ride.id,
            refundAmount,
            type: 'ride_cancelled'
          }
        )

        await saveNotification(
          userId,
          'ride_cancelled',
          {
            rideId: ride.id,
            refundAmount
          }
        )
      }
    } catch (notifError) {
      console.error('Error sending notification:', notifError)
    }

    res.json({
      success: true,
      message: 'Ride cancelled successfully',
      data: {
        ride: result.updatedRide,
        refundAmount: result.refundAmount
      }
    })
  } catch (error) {
    console.error('Cancel scheduled ride error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel ride'
    })
  }
}

/**
 * Calculate fare for scheduled ride
 */
async function calculateFare({ service, distance, duration, couponCode, extraCharges }) {
  let baseFare = 0
  let minimumFare = 0
  let perDistance = 0
  let perMinuteDrive = 0
  let subtotal = 0
  let couponDiscount = 0
  let extraChargesAmount = 0

  if (service) {
    baseFare = service.baseFare || 0
    minimumFare = service.minimumFare || 0
    perDistance = service.perDistance || 0
    perMinuteDrive = service.perMinuteDrive || 0
  }

  // Calculate distance and time charges
  const distanceCharge = distance ? distance * perDistance : 0
  const timeCharge = duration ? (duration / 60) * perMinuteDrive : 0

  subtotal = baseFare + distanceCharge + timeCharge

  // Apply minimum fare
  if (subtotal < minimumFare) {
    subtotal = minimumFare
  }

  // Apply coupon if provided
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.toString() }
    })

    if (coupon && coupon.status === 1) {
      const now = new Date()
      if (coupon.startDate <= now && coupon.endDate >= now) {
        if (coupon.discountType === 'percentage') {
          couponDiscount = (subtotal * coupon.discount) / 100
          if (coupon.maximumDiscount) {
            couponDiscount = Math.min(couponDiscount, coupon.maximumDiscount)
          }
        } else {
          couponDiscount = coupon.discount || 0
        }
      }
    }
  }

  // Calculate extra charges
  if (extraCharges && Array.isArray(extraCharges)) {
    extraChargesAmount = extraCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0)
  }

  const totalAmount = Math.max(0, subtotal - couponDiscount + extraChargesAmount)

  return {
    baseFare,
    minimumFare,
    perDistance,
    perMinuteDrive,
    distance: distance || 0,
    duration: duration || 0,
    perDistanceCharge: distanceCharge,
    perMinuteDriveCharge: timeCharge,
    subtotal,
    couponDiscount,
    couponCode: couponCode ? parseInt(couponCode) : null,
    extraChargesAmount,
    totalAmount
  }
}

/**
 * Calculate refund amount based on cancellation policy
 * Policy: Full refund if cancelled more than 1 hour before scheduled time
 * 50% refund if cancelled within 1 hour
 * No refund if cancelled after activation
 */
function calculateRefundAmount(ride) {
  const now = new Date()
  const scheduledTime = new Date(ride.scheduleDatetime)
  const hoursUntilRide = (scheduledTime - now) / (1000 * 60 * 60)

  // If already active or completed, no refund
  if (ride.status === 'active' || ride.status === 'completed') {
    return 0
  }

  // Full refund if more than 1 hour before
  if (hoursUntilRide > 1) {
    return ride.totalAmount
  }

  // 50% refund if within 1 hour
  if (hoursUntilRide > 0) {
    return ride.totalAmount * 0.5
  }

  // No refund if past scheduled time
  return 0
}

