import prisma from '../utils/prisma.js';
import { sendNotificationToUsers } from '../utils/notificationService.js';

/**
 * Send push notification about a new promotion to app users (riders).
 * Runs asynchronously and does not block the main thread.
 */
export function sendPromotionNotification(promotion) {
  setImmediate(async () => {
    try {
      const title = 'New promotion available';
      const message = promotion.discountType === 'PERCENTAGE'
        ? `${promotion.code}: ${promotion.discountValue}% off. Valid until ${new Date(promotion.endDate).toLocaleDateString()}`
        : `${promotion.code}: ${promotion.discountValue} off. Valid until ${new Date(promotion.endDate).toLocaleDateString()}`;

      const users = await prisma.user.findMany({
        where: {
          userType: 'rider',
          OR: [
            { fcmToken: { not: null } },
            { playerId: { not: null } },
          ],
        },
        select: { id: true, fcmToken: true, playerId: true },
      });

      if (users.length === 0) return;

      await sendNotificationToUsers(users, title, message, {
        type: 'PROMOTION',
        promotionId: promotion.id,
        code: promotion.code,
        discountType: promotion.discountType,
        discountValue: String(promotion.discountValue),
        endDate: promotion.endDate,
      });
    } catch (err) {
      console.error('Promotion push notification error:', err);
    }
  });
}
