const mongoose = require('mongoose');
const reservationModel = require('../schemas/reservations');
const inventoryModel = require('../schemas/inventories');
const cartModel = require('../schemas/carts');
const productModel = require('../schemas/products');

module.exports = {
    getAllReservations: async function (userId) {
        return await reservationModel.find({ user: userId }).populate('items.product');
    },

    getReservationById: async function (id, userId) {
        return await reservationModel.findOne({ _id: id, user: userId }).populate('items.product');
    },

    reserveACart: async function (userId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // 1. Tìm giỏ hàng của user
            const cart = await cartModel.findOne({ user: userId }).populate('cartItems.product');
            if (!cart || cart.cartItems.length === 0) {
                throw new Error("Giỏ hàng trống");
            }

            let totalAmount = 0;
            const reservationItems = [];

            // 2. Kiểm tra tồn kho và chuẩn bị dữ liệu reservation
            for (const item of cart.cartItems) {
                const product = item.product;
                const quantity = item.quantity;

                const inventory = await inventoryModel.findOne({ product: product._id }).session(session);
                if (!inventory || inventory.stock < quantity) {
                    throw new Error(`Sản phẩm ${product.title} không đủ tồn kho`);
                }

                // Cập nhật tồn kho
                inventory.stock -= quantity;
                inventory.reserved += quantity;
                await inventory.save({ session });

                const subtotal = product.price * quantity;
                totalAmount += subtotal;

                reservationItems.push({
                    product: product._id,
                    quantity: quantity,
                    title: product.title,
                    price: product.price,
                    subtotal: subtotal
                });
            }

            // 3. Tạo Reservation
            const expiredIn = new Date();
            expiredIn.setHours(expiredIn.getHours() + 24); // Hết hạn sau 24h

            const newReservation = new reservationModel({
                user: userId,
                items: reservationItems,
                amount: totalAmount,
                status: 'actived',
                expiredIn: expiredIn
            });

            await newReservation.save({ session });

            // 4. Xóa giỏ hàng
            cart.cartItems = [];
            await cart.save({ session });

            await session.commitTransaction();
            return newReservation;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    },

    reserveItems: async function (userId, items) {
        // items: [{ productId, quantity }]
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            let totalAmount = 0;
            const reservationItems = [];

            for (const item of items) {
                const product = await productModel.findById(item.productId).session(session);
                if (!product) throw new Error(`Sản phẩm ID ${item.productId} không tồn tại`);

                const quantity = item.quantity;
                const inventory = await inventoryModel.findOne({ product: product._id }).session(session);
                if (!inventory || inventory.stock < quantity) {
                    throw new Error(`Sản phẩm ${product.title} không đủ tồn kho`);
                }

                inventory.stock -= quantity;
                inventory.reserved += quantity;
                await inventory.save({ session });

                const subtotal = product.price * quantity;
                totalAmount += subtotal;

                reservationItems.push({
                    product: product._id,
                    quantity: quantity,
                    title: product.title,
                    price: product.price,
                    subtotal: subtotal
                });
            }

            const expiredIn = new Date();
            expiredIn.setHours(expiredIn.getHours() + 24);

            const newReservation = new reservationModel({
                user: userId,
                items: reservationItems,
                amount: totalAmount,
                status: 'actived',
                expiredIn: expiredIn
            });

            await newReservation.save({ session });

            await session.commitTransaction();
            return newReservation;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    },

    cancelReservation: async function (reservationId, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const reservation = await reservationModel.findOne({ _id: reservationId, user: userId }).session(session);
            if (!reservation) throw new Error("Không tìm thấy đơn đặt hàng");
            if (reservation.status !== 'actived') throw new Error("Không thể hủy đơn hàng này");

            // Hoàn tồn kho
            for (const item of reservation.items) {
                const inventory = await inventoryModel.findOne({ product: item.product }).session(session);
                if (inventory) {
                    inventory.stock += item.quantity;
                    inventory.reserved -= item.quantity;
                    await inventory.save({ session });
                }
            }

            reservation.status = 'cancelled';
            await reservation.save({ session });

            await session.commitTransaction();
            return reservation;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
};
