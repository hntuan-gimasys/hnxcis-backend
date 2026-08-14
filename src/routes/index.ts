/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { geminiRouter } from './gemini.ts';
import { healthRouter } from './health.ts';

export const apiRouter = Router();

apiRouter.use('/', healthRouter);
apiRouter.use('/gemini', geminiRouter);
