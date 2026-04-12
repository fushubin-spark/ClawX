/**
 * Hermes API Routes
 * Manages multiple Hermes instances
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { hermesManager, type HermesInstanceStatus } from '../../services/hermes-manager';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

type RouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, ctx: HostApiContext) => Promise<boolean>;

// GET /api/hermes/instances - List all instances
export async function listHermesInstances(ctx: HostApiContext): Promise<void> {
  const instances = hermesManager.listInstances();
  sendJson(ctx.res, instances);
}

// POST /api/hermes/instances - Add a new instance
export async function addHermesInstance(ctx: HostApiContext): Promise<void> {
  const body = await parseJsonBody<{ name: string; hermesHome: string }>(ctx.req);
  if (!body.name || !body.hermesHome) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'name and hermesHome are required' });
    return;
  }

  try {
    const config = hermesManager.addInstance(body.name, body.hermesHome);
    sendJson(ctx.res, { success: true, config });
  } catch (err) {
    ctx.res.statusCode = 500;
    sendJson(ctx.res, { error: (err as Error).message });
  }
}

// DELETE /api/hermes/instances/:id - Remove an instance
export async function removeHermesInstance(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  try {
    await hermesManager.removeInstance(instanceId);
    sendJson(ctx.res, { success: true });
  } catch (err) {
    ctx.res.statusCode = 500;
    sendJson(ctx.res, { error: (err as Error).message });
  }
}

// GET /api/hermes/instances/:id - Get instance details
export async function getHermesInstance(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  const instance = hermesManager.getInstance(instanceId);
  if (!instance) {
    ctx.res.statusCode = 404;
    sendJson(ctx.res, { error: 'Instance not found' });
    return;
  }

  sendJson(ctx.res, instance);
}

// POST /api/hermes/instances/:id/start - Start instance
export async function startHermesInstance(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  try {
    hermesManager.startInstance(instanceId);
    sendJson(ctx.res, { success: true });
  } catch (err) {
    ctx.res.statusCode = 500;
    sendJson(ctx.res, { error: (err as Error).message });
  }
}

// POST /api/hermes/instances/:id/stop - Stop instance
export async function stopHermesInstance(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  try {
    await hermesManager.stopInstance(instanceId);
    sendJson(ctx.res, { success: true });
  } catch (err) {
    ctx.res.statusCode = 500;
    sendJson(ctx.res, { error: (err as Error).message });
  }
}

// POST /api/hermes/instances/:id/restart - Restart instance
export async function restartHermesInstance(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  try {
    hermesManager.restartInstance(instanceId);
    sendJson(ctx.res, { success: true });
  } catch (err) {
    ctx.res.statusCode = 500;
    sendJson(ctx.res, { error: (err as Error).message });
  }
}

// PATCH /api/hermes/instances/:id - Update instance
export async function updateHermesInstance(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  const body = await parseJsonBody<{ name?: string }>(ctx.req);
  try {
    hermesManager.updateInstance(instanceId, { name: body.name });
    sendJson(ctx.res, { success: true });
  } catch (err) {
    ctx.res.statusCode = 500;
    sendJson(ctx.res, { error: (err as Error).message });
  }
}

// GET /api/hermes/instances/:id/output - Get output buffer
export async function getHermesOutput(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  const lines = parseInt(ctx.query?.lines as string || '100', 10);
  const output = hermesManager.getOutput(instanceId, lines);
  sendJson(ctx.res, { output });
}

// POST /api/hermes/instances/:id/inject - Inject command
export async function injectHermesCommand(ctx: HostApiContext): Promise<void> {
  const instanceId = ctx.params?.id;
  if (!instanceId) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'Instance ID required' });
    return;
  }

  const body = await parseJsonBody<{ command: string }>(ctx.req);
  if (!body.command) {
    ctx.res.statusCode = 400;
    sendJson(ctx.res, { error: 'command is required' });
    return;
  }

  hermesManager.injectCommand(instanceId, body.command);
  sendJson(ctx.res, { success: true });
}

export const handleHermesRoutes: RouteHandler = async (req, res, url) => {
  const pathname = url.pathname;

  if (pathname === '/api/hermes/instances' && req.method === 'GET') {
    const instances = hermesManager.listInstances();
    sendJson(res, instances);
    return true;
  }

  if (pathname === '/api/hermes/instances' && req.method === 'POST') {
    const body = await parseJsonBody<{ name: string; hermesHome: string }>(req);
    if (!body.name || !body.hermesHome) {
      res.statusCode = 400;
      sendJson(res, { error: 'name and hermesHome are required' });
      return true;
    }
    try {
      const config = hermesManager.addInstance(body.name, body.hermesHome);
      sendJson(res, { success: true, config });
    } catch (err) {
      res.statusCode = 500;
      sendJson(res, { error: (err as Error).message });
    }
    return true;
  }

  // Match /api/hermes/instances/:id/*
  const instancesMatch = pathname.match(/^\/api\/hermes\/instances\/([^/]+)(\/.*)?$/);
  if (!instancesMatch) return false;

  const instanceId = instancesMatch[1];
  const action = instancesMatch[2] || '';

  if (action === '' || action === '/') {
    if (req.method === 'GET') {
      const instance = hermesManager.getInstance(instanceId);
      if (!instance) { res.statusCode = 404; sendJson(res, { error: 'Instance not found' }); return true; }
      sendJson(res, instance);
      return true;
    }
    if (req.method === 'PATCH') {
      const body = await parseJsonBody<{ name?: string }>(req);
      hermesManager.updateInstance(instanceId, { name: body.name });
      sendJson(res, { success: true });
      return true;
    }
    if (req.method === 'DELETE') {
      await hermesManager.removeInstance(instanceId);
      sendJson(res, { success: true });
      return true;
    }
    return false;
  }

  if (action === '/start' && req.method === 'POST') {
    hermesManager.startInstance(instanceId);
    sendJson(res, { success: true });
    return true;
  }

  if (action === '/stop' && req.method === 'POST') {
    await hermesManager.stopInstance(instanceId);
    sendJson(res, { success: true });
    return true;
  }


  if (action === '/restart' && req.method === 'POST') {
    hermesManager.restartInstance(instanceId);
    sendJson(res, { success: true });
    return true;
  }

  if (action === '/output' && req.method === 'GET') {
    const lines = parseInt(url.searchParams.get('lines') || '100', 10);
    const output = hermesManager.getOutput(instanceId, lines);
    sendJson(res, { output });
    return true;
  }

  if (action === '/inject' && req.method === 'POST') {
    const body = await parseJsonBody<{ command: string }>(req);
    if (!body.command) { res.statusCode = 400; sendJson(res, { error: 'command is required' }); return true; }
    hermesManager.injectCommand(instanceId, body.command);
    sendJson(res, { success: true });
    return true;
  }

  return false;
};

