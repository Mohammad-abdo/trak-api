import prisma from "../utils/prisma.js";

// @desc    List payment methods (admin)
// @route   GET /api/payment-methods
// @access  Private
export const list = async (req, res) => {
    try {
        const methods = await prisma.paymentMethod.findMany({
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        res.json({ success: true, data: methods });
    } catch (error) {
        console.error("List payment methods error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create payment method
// @route   POST /api/payment-methods
// @access  Private
export const create = async (req, res) => {
    try {
        const { name, nameAr, code, status = 1, sortOrder = 0 } = req.body;
        if (!name || !code) {
            return res.status(400).json({
                success: false,
                message: "name and code are required",
            });
        }
        const codeSlug = String(code).trim().toLowerCase().replace(/\s+/g, "_");
        const existing = await prisma.paymentMethod.findUnique({
            where: { code: codeSlug },
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Payment method with this code already exists",
            });
        }
        const method = await prisma.paymentMethod.create({
            data: {
                name: String(name).trim(),
                nameAr: nameAr ? String(nameAr).trim() : null,
                code: codeSlug,
                status: status === 1 || status === "1" ? 1 : 0,
                sortOrder: parseInt(sortOrder, 10) || 0,
            },
        });
        res.status(201).json({ success: true, message: "Payment method created", data: method });
    } catch (error) {
        console.error("Create payment method error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update payment method
// @route   PUT /api/payment-methods/:id
// @access  Private
export const update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid id" });
        }
        const { name, nameAr, code, status, sortOrder } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = String(name).trim();
        if (nameAr !== undefined) updateData.nameAr = nameAr ? String(nameAr).trim() : null;
        if (code !== undefined) {
            const codeSlug = String(code).trim().toLowerCase().replace(/\s+/g, "_");
            const existing = await prisma.paymentMethod.findFirst({
                where: { code: codeSlug, NOT: { id } },
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Another payment method with this code already exists",
                });
            }
            updateData.code = codeSlug;
        }
        if (status !== undefined) updateData.status = status === 1 || status === "1" ? 1 : 0;
        if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10) || 0;

        const method = await prisma.paymentMethod.update({
            where: { id },
            data: updateData,
        });
        res.json({ success: true, message: "Payment method updated", data: method });
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ success: false, message: "Payment method not found" });
        }
        console.error("Update payment method error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle payment method status (convenience)
// @route   PATCH /api/payment-methods/:id/toggle
// @access  Private
export const toggleStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid id" });
        }
        const current = await prisma.paymentMethod.findUnique({ where: { id } });
        if (!current) {
            return res.status(404).json({ success: false, message: "Payment method not found" });
        }
        const newStatus = current.status === 1 ? 0 : 1;
        const method = await prisma.paymentMethod.update({
            where: { id },
            data: { status: newStatus },
        });
        res.json({ success: true, message: "Status updated", data: method });
    } catch (error) {
        console.error("Toggle payment method error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete payment method
// @route   DELETE /api/payment-methods/:id
// @access  Private
export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid id" });
        }
        await prisma.paymentMethod.delete({ where: { id } });
        res.json({ success: true, message: "Payment method deleted" });
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ success: false, message: "Payment method not found" });
        }
        console.error("Delete payment method error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
