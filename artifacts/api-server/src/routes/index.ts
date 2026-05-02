import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import productsRouter from "./products.js";
import categoriesRouter from "./categories.js";
import cartRouter from "./cart.js";
import ordersRouter from "./orders.js";
import couponsRouter from "./coupons.js";
import reviewsRouter from "./reviews.js";
import usersRouter from "./users.js";
import trackingRouter from "./tracking.js";
import notificationsRouter from "./notifications.js";
import analyticsRouter from "./analytics.js";
import favoritesRouter from "./favorites.js";
import bannersRouter from "./banners.js";
import referralsRouter from "./referrals.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/categories", categoriesRouter);
router.use("/cart", cartRouter);
router.use("/orders", ordersRouter);
router.use("/coupons", couponsRouter);
router.use("/reviews", reviewsRouter);
router.use("/users", usersRouter);
router.use("/tracking", trackingRouter);
router.use("/notifications", notificationsRouter);
router.use("/analytics", analyticsRouter);
router.use("/favorites", favoritesRouter);
router.use("/banners", bannersRouter);
router.use("/referrals", referralsRouter);

export default router;
