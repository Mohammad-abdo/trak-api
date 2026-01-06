/**
 * Scheduled Ride Activation Service
 * 
 * This service handles automatic activation of prepaid scheduled rides.
 * It runs as a background job every minute to check for rides that need activation.
 * 
 * Features:
 * - Atomic updates using Prisma transactions to prevent duplicate activation
 * - Driver assignment logic
 * - Notification system integration
 * - Error handling and logging
 */

import prisma from './prisma.js'
import { sendNotificationToUsers, saveNotification } from './notificationService.js'

/**
 * Find and activate scheduled rides that are due
 * This function is called by the cron job every minute
 */
export const activateScheduledRides = async () => {
  try {
    const now = new Date()
    
    // Find rides that need activation:
    // - isSchedule = true
    // - scheduleDatetime <= now
    // - isPrepaid = true
    // - status = 'scheduled' (or 'pending' for backward compatibility)
    // - Has a payment with status = 'paid'
    const ridesToActivate = await prisma.rideRequest.findMany({
      where: {
        isSchedule: true,
        isPrepaid: true,
        scheduleDatetime: {
          lte: now
        },
        status: {
          in: ['scheduled', 'pending'] // Support both statuses
        },
        payments: {
          some: {
            paymentStatus: 'paid'
          }
        },
        driverId: null // Not yet assigned
      },
      include: {
        rider: true,
        service: true,
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
      take: 50 // Process max 50 rides per minute to avoid overload
    })

    if (ridesToActivate.length === 0) {
      return { activated: 0, failed: 0, expired: 0 }
    }

    let activated = 0
    let failed = 0
    let expired = 0

    // Process each ride
    for (const ride of ridesToActivate) {
      try {
        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Re-check status to prevent race conditions
          const currentRide = await tx.rideRequest.findUnique({
            where: { id: ride.id },
            select: { status: true, driverId: true }
          })

          // Skip if already processed
          if (currentRide.status !== 'scheduled' && currentRide.status !== 'pending') {
            return { success: false, reason: 'already_processed' }
          }

          if (currentRide.driverId) {
            return { success: false, reason: 'driver_assigned' }
          }

          // Find available driver
          const driver = await findAvailableDriver(tx, ride)

          if (!driver) {
            // No driver available - mark as expired or retry later
            // For now, we'll mark as expired if it's been more than 15 minutes past scheduled time
            const minutesPast = (now - ride.scheduleDatetime) / (1000 * 60)
            
            if (minutesPast > 15) {
              await tx.rideRequest.update({
                where: { id: ride.id },
                data: { status: 'expired' }
              })
              return { success: false, reason: 'expired', expired: true }
            }
            
            return { success: false, reason: 'no_driver' }
          }

          // Activate the ride
          await tx.rideRequest.update({
            where: { id: ride.id },
            data: {
              status: 'active',
              driverId: driver.id,
              datetime: now,
              riderequestInDriverId: driver.id,
              riderequestInDatetime: now
            }
          })

          // Update driver status
          await tx.user.update({
            where: { id: driver.id },
            data: {
              isAvailable: false
            }
          })

          return { success: true, driver }
        }, {
          timeout: 10000, // 10 second timeout
          isolationLevel: 'Serializable' // Highest isolation to prevent race conditions
        })

        if (result.success) {
          activated++
          
          // Send notifications
          await sendRideActivatedNotifications(ride, result.driver)
        } else if (result.expired) {
          expired++
          await sendRideExpiredNotification(ride)
        } else {
          failed++
          console.warn(`Failed to activate ride ${ride.id}: ${result.reason}`)
        }
      } catch (error) {
        failed++
        console.error(`Error activating ride ${ride.id}:`, error)
        
        // Send error notification to user
        try {
          await sendRideActivationFailedNotification(ride, error.message)
        } catch (notifError) {
          console.error('Failed to send error notification:', notifError)
        }
      }
    }

    console.log(`Scheduled ride activation: ${activated} activated, ${failed} failed, ${expired} expired`)
    
    return { activated, failed, expired }
  } catch (error) {
    console.error('Error in activateScheduledRides:', error)
    return { activated: 0, failed: 0, expired: 0, error: error.message }
  }
}

/**
 * Find an available driver for the ride
 * Priority:
 * 1. Drivers in the same service
 * 2. Drivers who are online and available
 * 3. Drivers closest to pickup location
 */
async function findAvailableDriver(tx, ride) {
  const where = {
    userType: 'driver',
    status: 'active',
    isOnline: true,
    isAvailable: true,
    isVerifiedDriver: true
  }

  // If ride has a service, prefer drivers for that service
  if (ride.serviceId) {
    where.driverServices = {
      some: {
        serviceId: ride.serviceId,
        status: 1
      }
    }
  }

  // Find available drivers
  const drivers = await tx.user.findMany({
    where,
    include: {
      driverServices: ride.serviceId ? {
        where: { serviceId: ride.serviceId }
      } : true
    },
    take: 10 // Get top 10 candidates
  })

  if (drivers.length === 0) {
    return null
  }

  // If we have pickup coordinates, find closest driver
  if (ride.startLatitude && ride.startLongitude) {
    // Simple distance calculation (for production, use proper geospatial queries)
    const pickupLat = parseFloat(ride.startLatitude)
    const pickupLng = parseFloat(ride.startLongitude)

    const driversWithDistance = drivers.map(driver => {
      if (driver.latitude && driver.longitude) {
        const driverLat = parseFloat(driver.latitude)
        const driverLng = parseFloat(driver.longitude)
        
        // Haversine distance calculation (simplified)
        const distance = calculateDistance(pickupLat, pickupLng, driverLat, driverLng)
        return { driver, distance }
      }
      return { driver, distance: Infinity }
    })

    // Sort by distance and return closest
    driversWithDistance.sort((a, b) => a.distance - b.distance)
    return driversWithDistance[0].distance < Infinity ? driversWithDistance[0].driver : drivers[0]
  }

  // No coordinates, return first available driver
  return drivers[0]
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Send notifications when ride is activated
 */
async function sendRideActivatedNotifications(ride, driver) {
  try {
    // Get rider and driver data for notifications
    const rider = await prisma.user.findUnique({
      where: { id: ride.riderId },
      select: { id: true, playerId: true, fcmToken: true, firstName: true, lastName: true }
    })

    const driverData = await prisma.user.findUnique({
      where: { id: driver.id },
      select: { id: true, playerId: true, fcmToken: true, firstName: true, lastName: true }
    })

    // Notify rider
    if (rider) {
      await sendNotificationToUsers(
        [rider],
        'Ride Activated',
        `Your scheduled ride has been activated. Driver ${driver.firstName} ${driver.lastName} is on the way.`,
        {
          rideId: ride.id,
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
          driverPhone: driver.contactNumber,
          type: 'ride_activated'
        }
      )

      await saveNotification(
        ride.riderId,
        'ride_activated',
        {
          rideId: ride.id,
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`
        }
      )
    }

    // Notify driver
    if (driverData) {
      await sendNotificationToUsers(
        [driverData],
        'New Ride Assigned',
        `You have been assigned a scheduled ride. Pickup: ${ride.startAddress || 'Location provided'}`,
        {
          rideId: ride.id,
          riderId: ride.riderId,
          pickupAddress: ride.startAddress,
          dropoffAddress: ride.endAddress,
          type: 'new_ride_assigned'
        }
      )

      await saveNotification(
        driver.id,
        'new_ride_assigned',
        {
          rideId: ride.id,
          riderId: ride.riderId,
          pickupAddress: ride.startAddress
        }
      )
    }

    // Send via Socket.IO if available
    const io = global.io
    if (io) {
      io.to(`user-${ride.riderId}`).emit('ride_status_update', {
        rideId: ride.id,
        status: 'active',
        driver: {
          id: driver.id,
          name: `${driver.firstName} ${driver.lastName}`,
          phone: driver.contactNumber
        }
      })

      io.to(`driver-${driver.id}`).emit('new_ride_request', {
        rideId: ride.id,
        pickup: {
          address: ride.startAddress,
          latitude: ride.startLatitude,
          longitude: ride.startLongitude
        },
        dropoff: {
          address: ride.endAddress,
          latitude: ride.endLatitude,
          longitude: ride.endLongitude
        }
      })
    }
  } catch (error) {
    console.error('Error sending activation notifications:', error)
  }
}

/**
 * Send notification when ride expires (no driver available)
 */
async function sendRideExpiredNotification(ride) {
  try {
    const rider = await prisma.user.findUnique({
      where: { id: ride.riderId },
      select: { id: true, playerId: true, fcmToken: true }
    })

    if (rider) {
      await sendNotificationToUsers(
        [rider],
        'Ride Expired',
        'Your scheduled ride could not be activated as no driver was available. A refund will be processed.',
        {
          rideId: ride.id,
          type: 'ride_expired'
        }
      )

      await saveNotification(
        ride.riderId,
        'ride_expired',
        { rideId: ride.id }
      )
    }

    // Initiate refund process
    // This would typically call a payment service to process refund
    console.log(`Initiating refund for expired ride ${ride.id}`)
    
    // Update payment status to refunded
    await prisma.payment.updateMany({
      where: {
        rideRequestId: ride.id,
        paymentStatus: 'paid'
      },
      data: {
        paymentStatus: 'refunded'
      }
    })
  } catch (error) {
    console.error('Error sending expired notification:', error)
  }
}

/**
 * Send notification when ride activation fails
 */
async function sendRideActivationFailedNotification(ride, errorMessage) {
  try {
    const rider = await prisma.user.findUnique({
      where: { id: ride.riderId },
      select: { id: true, playerId: true, fcmToken: true }
    })

    if (rider) {
      await sendNotificationToUsers(
        [rider],
        'Ride Activation Failed',
        `There was an error activating your scheduled ride: ${errorMessage}. Please contact support.`,
        {
          rideId: ride.id,
          error: errorMessage,
          type: 'ride_activation_failed'
        }
      )

      await saveNotification(
        ride.riderId,
        'ride_activation_failed',
        { rideId: ride.id, error: errorMessage }
      )
    }
  } catch (error) {
    console.error('Error sending failure notification:', error)
  }
}

