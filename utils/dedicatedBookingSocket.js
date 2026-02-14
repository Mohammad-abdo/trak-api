import * as dedicatedBookingService from '../services/dedicatedBookingService.js';

/**
 * Register Socket.io handlers for dedicated booking live tracking.
 * Call this from server.js inside io.on('connection', (socket) => { ... }).
 * Driver sends: bookingId, currentLat, currentLng.
 * Server saves to BookingLocationUpdate and broadcasts to user room.
 */
export function registerDedicatedBookingHandlers(socket, io) {
  socket.on('dedicated-booking-location', async (payload) => {
      const { bookingId, currentLat, currentLng } = payload || {};
      if (!bookingId || typeof currentLat !== 'number' || typeof currentLng !== 'number') {
        socket.emit('dedicated-booking-location-error', { message: 'Invalid payload' });
        return;
      }
      try {
        await dedicatedBookingService.recordLocationUpdate(bookingId, currentLat, currentLng);
        const booking = await dedicatedBookingService.getById(bookingId);
        const userId = booking.userId;
        io.to(`user-${userId}`).emit('dedicated-booking-location-update', {
          bookingId,
          lat: currentLat,
          lng: currentLng,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit('dedicated-booking-location-error', { message: err.message });
      }
    });

  socket.on('subscribe-dedicated-booking', (bookingId) => {
    socket.join(`dedicated-booking-${bookingId}`);
  });
}
