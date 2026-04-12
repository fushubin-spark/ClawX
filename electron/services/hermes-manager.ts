/**
 * Hermes Instance Manager
 * Manages multiple Hermes Agent instances as child processes
 */
import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

export interface HermesInstanceConfig {
  id: string;
  name: string;
  hermesHome: string;
  color: string; // instance identifier color
}

export interface HermesInstanceStatus {
  id: string;
  name: string;
  state: 'stopped' | 'starting' | 'running' | 'error';
  pid?: number;
  uptime?: number;
  model?: string;
  error?: string;
  hermesHome: string;
  color: string;
}

export interface HermesInstanceOutput {
  instanceId: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}

const INSTANCE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
];

export class HermesInstanceManager extends EventEmitter {
  private instances: Map<string, {
    config: HermesInstanceConfig;
    process?: ChildProcess;
    status: HermesInstanceStatus;
    outputBuffer: string[];
    startedAt?: number;
  }> = new Map();
  private outputLineCounter = 0;

  constructor() {
    super();
    this.loadInstances();
  }

  /**
   * Get instances directory, ensuring it exists
   */
  private getInstancesDir(): string {
    const dir = path.join(os.homedir(), '.hermes', 'instances');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get path to instances manifest
   */
  private getManifestPath(): string {
    return path.join(this.getInstancesDir(), 'instances.json');
  }

  /**
   * Load instances from manifest
   */
  private loadInstances(): void {
    const manifestPath = this.getManifestPath();
    if (!existsSync(manifestPath)) return;

    try {
      const data = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      for (const inst of data.instances || []) {
        const colorIndex = this.instances.size % INSTANCE_COLORS.length;
        const instance: HermesInstanceStatus = {
          id: inst.id,
          name: inst.name,
          state: 'stopped',
          hermesHome: inst.hermesHome,
          color: inst.color || INSTANCE_COLORS[colorIndex],
          model: undefined,
        };
        this.instances.set(inst.id, {
          config: inst,
          status: instance,
          outputBuffer: [],
        });
      }
    } catch (e) {
      console.error('[HermesManager] Failed to load instances:', e);
    }
  }

  /**
   * Persist instances to manifest
   */
  private saveInstances(): void {
    const manifestPath = this.getManifestPath();
    const data = {
      instances: Array.from(this.instances.values()).map(i => i.config),
    };
    writeFileSync(manifestPath, JSON.stringify(data, null, 2));
  }

  /**
   * Generate next color for a new instance
   */
  private getNextColor(): string {
    const colorIndex = this.instances.size % INSTANCE_COLORS.length;
    return INSTANCE_COLORS[colorIndex];
  }

  /**
   * List all instances
   */
  listInstances(): HermesInstanceStatus[] {
    return Array.from(this.instances.values()).map(i => i.status);
  }

  /**
   * Get a specific instance status
   */
  getInstance(instanceId: string): HermesInstanceStatus | null {
    return this.instances.get(instanceId)?.status || null;
  }

  /**
   * Add a new Hermes instance
   */
  addInstance(name: string, hermesHome: string): HermesInstanceConfig {
    const id = `hermes-${Date.now()}`;
    const color = this.getNextColor();

    // Ensure the hermes home directory has a config
    const configPath = path.join(hermesHome, 'config.yaml');
    const instanceDir = path.dirname(hermesHome);

    const config: HermesInstanceConfig = {
      id,
      name,
      hermesHome,
      color,
    };

    this.instances.set(id, {
      config,
      status: {
        id,
        name,
        state: 'stopped',
        hermesHome,
        color,
      },
      outputBuffer: [],
    });

    this.saveInstances();
    return config;
  }

  /**
   * Remove an instance
   */
  async removeInstance(instanceId: string): Promise<void> {
    const inst = this.instances.get(instanceId);
    if (!inst) return;

    if (inst.status.state === 'running') {
      await this.stopInstance(instanceId);
    }

    this.instances.delete(instanceId);
    this.saveInstances();
  }

  /**
   * Start a Hermes instance
   */
  startInstance(instanceId: string): void {
    const inst = this.instances.get(instanceId);
    if (!inst) {
      this.emit('error', { instanceId, error: 'Instance not found' });
      return;
    }

    if (inst.status.state === 'running') {
      return;
    }

    const { hermesHome, config } = inst;
    const hermesBin = path.join(os.homedir(), 'hermes-agent', 'venv', 'bin', 'hermes');

    if (!existsSync(hermesBin)) {
      this.emit('output', {
        instanceId,
        line: `Error: Hermes binary not found at ${hermesBin}`,
        stream: 'stderr',
        timestamp: Date.now(),
      } as HermesInstanceOutput);
      return;
    }

    // Update status to starting
    inst.status.state = 'starting';
    inst.startedAt = Date.now();
    this.emit('status', inst.status);

    // Set up environment
    const env = { ...process.env };
    env.HERMES_HOME = hermesHome;
    env.VIRTUAL_ENV = path.join(os.homedir(), 'hermes-agent', 'venv');
    env.PATH = `${path.join(os.homedir(), 'hermes-agent', 'venv', 'bin')}:${env.PATH}`;

    try {
      // Check if hermes command is available
      const proc = spawn(hermesBin, [], {
        cwd: hermesHome,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      inst.process = proc;
      inst.status.pid = proc.pid;
      inst.status.state = 'running';
      this.emit('status', inst.status);

      // Read stdout
      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (!line) return;
        this.emit('output', {
          instanceId,
          line,
          stream: 'stdout',
          timestamp: Date.now(),
        } as HermesInstanceOutput);
        inst.outputBuffer.push(line);
        if (inst.outputBuffer.length > 1000) {
          inst.outputBuffer.shift();
        }
      });

      // Read stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (!line) return;
        this.emit('output', {
          instanceId,
          line,
          stream: 'stderr',
          timestamp: Date.now(),
        } as HermesInstanceOutput);
        inst.outputBuffer.push(`[ERR] ${line}`);
        if (inst.outputBuffer.length > 1000) {
          inst.outputBuffer.shift();
        }
      });

      proc.on('exit', (code) => {
        inst.status.state = code === 0 ? 'stopped' : 'error';
        inst.status.error = code !== 0 ? `Exited with code ${code}` : undefined;
        inst.status.pid = undefined;
        inst.process = undefined;
        this.emit('status', inst.status);
        this.emit('exit', { instanceId, code });
      });

      proc.on('error', (err) => {
        inst.status.state = 'error';
        inst.status.error = err.message;
        inst.status.pid = undefined;
        this.emit('status', inst.status);
        this.emit('error', { instanceId, error: err });
      });

    } catch (err) {
      inst.status.state = 'error';
      inst.status.error = (err as Error).message;
      this.emit('status', inst.status);
    }
  }

  /**
   * Stop a Hermes instance
   */
  async stopInstance(instanceId: string): Promise<void> {
    const inst = this.instances.get(instanceId);
    if (!inst || !inst.process) return;

    return new Promise((resolve) => {
      const pid = inst.process!.pid;

      // Try graceful termination first
      inst.process!.on('exit', () => {
        inst.status.state = 'stopped';
        inst.status.pid = undefined;
        this.emit('status', inst.status);
        resolve();
      });

      try {
        process.kill(pid, 'SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // Process already dead
          }
        }, 5000);
      } catch (err) {
        console.error('[HermesManager] Failed to kill process:', err);
        inst.status.state = 'stopped';
        inst.status.pid = undefined;
        this.emit('status', inst.status);
        resolve();
      }
    });
  }

  /**
   * Restart an instance
   */
  restartInstance(instanceId: string): void {
    const inst = this.instances.get(instanceId);
    if (!inst) return;

    if (inst.status.state === 'running') {
      this.stopInstance(instanceId).then(() => {
        setTimeout(() => this.startInstance(instanceId), 1000);
      });
    } else {
      this.startInstance(instanceId);
    }
  }

  /**
   * Get output buffer for an instance
   */
  getOutput(instanceId: string, lines = 100): string[] {
    const inst = this.instances.get(instanceId);
    if (!inst) return [];
    return inst.outputBuffer.slice(-lines);
  }

  /**
   * Inject a command into a running instance's stdin
   * Note: Hermes doesn't have interactive stdin, this sends to the session
   */
  injectCommand(instanceId: string, command: string): void {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.status.state !== 'running') return;

    // For Hermes running in CLI mode, we can't easily inject commands
    // This would require Hermes to support a command-injection mechanism
    this.emit('output', {
      instanceId,
      line: `[INFO] Command injection: ${command}`,
      stream: 'stdout',
      timestamp: Date.now(),
    } as HermesInstanceOutput);
  }

  /**
   * Update instance config
   */
  updateInstance(instanceId: string, updates: Partial<Pick<HermesInstanceConfig, 'name'>>): void {
    const inst = this.instances.get(instanceId);
    if (!inst) return;

    if (updates.name) {
      inst.config.name = updates.name;
      inst.status.name = updates.name;
    }

    this.saveInstances();
    this.emit('status', inst.status);
  }
}

// Singleton export
export const hermesManager = new HermesInstanceManager();
