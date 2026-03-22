const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservations');
const { checkLogin } = require('../utils/authHandler');

// 1. GET /reservations/: Lấy tất cả đơn đặt hàng của user hiện tại.
router.get('/', checkLogin, async (req, res, next) => {
    try {
        const result = await reservationController.getAllReservations(req.userId);
        res.send(result);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 2. GET /reservations/:id: Lấy chi tiết 1 đơn hàng.
router.get('/:id', checkLogin, async (req, res, next) => {
    try {
        const result = await reservationController.getReservationById(req.params.id, req.userId);
        if (result) {
            res.send(result);
        } else {
            res.status(404).send({ message: "Không tìm thấy đơn đặt hàng" });
        }
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 3. POST /reserveACart: Đặt chỗ cho toàn bộ giỏ hàng.
router.post('/reserveACart', checkLogin, async (req, res, next) => {
    try {
        const result = await reservationController.reserveACart(req.userId);
        res.send(result);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 4. POST /reserveItems: Đặt chỗ cho danh sách sản phẩm cụ thể (body gồm list product và quantity).
router.post('/reserveItems', checkLogin, async (req, res, next) => {
    try {
        // req.body.items: [{ productId, quantity }]
        if (!req.body.items || !Array.isArray(req.body.items)) {
            return res.status(400).send({ message: "Danh sách sản phẩm không hợp lệ" });
        }
        const result = await reservationController.reserveItems(req.userId, req.body.items);
        res.send(result);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 5. POST /cancelReserve/:id: Hủy đặt chỗ (Yêu cầu bắt buộc: Phải sử dụng Database Transaction).
router.post('/cancelReserve/:id', checkLogin, async (req, res, next) => {
    try {
        const result = await reservationController.cancelReservation(req.params.id, req.userId);
        res.send(result);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
