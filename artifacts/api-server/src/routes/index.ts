import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import clientContactsRouter from "./clientContacts";
import projectsRouter from "./projects";
import changeRequestsRouter from "./changeRequests";
import approvalRouter from "./approval";
import dashboardRouter from "./dashboard";
import auditLogsRouter from "./auditLogs";
import teamRouter from "./team";
import webhooksRouter from "./webhooks";
import analyticsRouter from "./analytics";
import remindersRouter from "./reminders";
import savedViewsRouter from "./savedViews";
import exportsRouter from "./exports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(clientContactsRouter);
router.use(projectsRouter);
router.use(changeRequestsRouter);
router.use(approvalRouter);
router.use(dashboardRouter);
router.use(auditLogsRouter);
router.use(teamRouter);
router.use(webhooksRouter);
router.use(analyticsRouter);
router.use(remindersRouter);
router.use(savedViewsRouter);
router.use(exportsRouter);

export default router;
