import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import clientContactsRouter from "./clientContacts";
import projectsRouter from "./projects";
import changeRequestsRouter from "./changeRequests";
import approvalRouter from "./approval";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(clientContactsRouter);
router.use(projectsRouter);
router.use(changeRequestsRouter);
router.use(approvalRouter);
router.use(dashboardRouter);

export default router;
