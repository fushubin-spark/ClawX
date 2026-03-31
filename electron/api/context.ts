import type { BrowserWindow } from 'electron';
import type { GatewayManager } from '../gateway/manager';
import type { ClawHubService } from '../gateway/clawhub';
import type { SkillhubService } from '../gateway/skillhub';
import type { HostEventBus } from './event-bus';

export interface HostApiContext {
  gatewayManager: GatewayManager;
  clawHubService: ClawHubService;
  skillhubService: SkillhubService;
  eventBus: HostEventBus;
  mainWindow: BrowserWindow | null;
}
