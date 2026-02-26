import prisma from '../../utils/prisma.js';

const bankCardSelect = {
    id: true,
    cardHolderName: true,
    lastFourDigits: true,
    brand: true,
    expiryMonth: true,
    expiryYear: true,
    isDefault: true,
    createdAt: true,
};

// @desc    Add a payment card (last 4 digits + metadata only; never send full number)
// @route   POST /apimobile/user/add-bank-card
// @access  Private
export const addBankCard = async (req, res) => {
    try {
        const userId = req.user.id;
        const { cardHolderName, lastFourDigits, brand, expiryMonth, expiryYear, isDefault = false } = req.body;

        const digits = String(lastFourDigits ?? '').replace(/\D/g, '').slice(-4);
        if (digits.length !== 4) {
            return res.status(400).json({ success: false, message: 'Valid last 4 digits of card are required' });
        }

        if (isDefault) {
            await prisma.userBankCard.updateMany({ where: { userId }, data: { isDefault: false } });
        }

        const card = await prisma.userBankCard.create({
            data: {
                userId,
                cardHolderName: cardHolderName?.trim() || null,
                lastFourDigits: digits,
                brand: brand?.trim() || null,
                expiryMonth: expiryMonth != null ? parseInt(expiryMonth, 10) : null,
                expiryYear: expiryYear != null ? parseInt(expiryYear, 10) : null,
                isDefault: !!isDefault,
            },
            select: bankCardSelect,
        });

        return res.status(201).json({ success: true, message: 'Card added', data: card });
    } catch (error) {
        console.error('Add bank card error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to add card' });
    }
};

// @desc    Get user's saved payment cards
// @route   GET /apimobile/user/bank-cards
// @access  Private
export const getBankCards = async (req, res) => {
    try {
        const userId = req.user.id;

        const cards = await prisma.userBankCard.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            select: bankCardSelect,
        });

        return res.json({ success: true, message: 'Cards retrieved', data: cards });
    } catch (error) {
        console.error('Get bank cards error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get cards' });
    }
};

// @desc    Delete a saved payment card
// @route   DELETE /apimobile/user/bank-cards/:id
// @access  Private
export const deleteBankCard = async (req, res) => {
    try {
        const userId = req.user.id;
        const id = parseInt(req.params.id, 10);

        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid card id' });
        }

        const card = await prisma.userBankCard.findFirst({ where: { id, userId } });

        if (!card) {
            return res.status(404).json({ success: false, message: 'Card not found' });
        }

        await prisma.userBankCard.delete({ where: { id } });

        return res.json({ success: true, message: 'Card deleted' });
    } catch (error) {
        console.error('Delete bank card error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to delete card' });
    }
};
