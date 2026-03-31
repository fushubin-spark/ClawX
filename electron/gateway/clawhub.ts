/**
 * ClawHub Service
 * Manages interactions with the ClawHub CLI for skills management
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';
import { getOpenClawConfigDir, ensureDir, getClawHubCliBinPath, getClawHubCliEntryPath, quoteForCmd } from '../utils/paths';

export interface ClawHubSearchParams {
    query: string;
    limit?: number;
    registry?: string;
}

export interface ClawHubInstallParams {
    slug: string;
    version?: string;
    force?: boolean;
    registry?: string;
}

export interface ClawHubUninstallParams {
    slug: string;
}

export interface ClawHubUpdateParams {
    slug: string;
    version?: string;
    force?: boolean;
    registry?: string;
}

export interface ClawHubExploreParams {
    limit?: number;
    registry?: string;
}

export interface ClawHubListParams {
    registry?: string;
}

export interface ClawHubSkillResult {
    slug: string;
    name: string;
    description: string;
    version: string;
    author?: string;
    downloads?: number;
    stars?: number;
}

export interface ClawHubInstalledSkillResult {
    slug: string;
    version: string;
    source?: string;
    baseDir?: string;
}

export class ClawHubService {
    private workDir: string;
    private cliPath: string;
    private cliEntryPath: string;
    private useNodeRunner: boolean;
    private ansiRegex: RegExp;
    private _registry: string | undefined;

    /**
     * Get the current registry URL
     */
    public get registry(): string | undefined {
        return this._registry;
    }

    /**
     * Set the registry URL for all subsequent commands
     */
    public setRegistry(registry: string | undefined): void {
        this._registry = registry;
    }

    constructor() {
        // Use the user's OpenClaw config directory (~/.openclaw) for skill management
        // This avoids installing skills into the project's openclaw submodule
        this.workDir = getOpenClawConfigDir();
        ensureDir(this.workDir);

        const binPath = getClawHubCliBinPath();
        const entryPath = getClawHubCliEntryPath();

        this.cliEntryPath = entryPath;
        if (!app.isPackaged && fs.existsSync(binPath)) {
            this.cliPath = binPath;
            this.useNodeRunner = false;
        } else {
            this.cliPath = process.execPath;
            this.useNodeRunner = true;
        }
        const esc = String.fromCharCode(27);
        const csi = String.fromCharCode(155);
        const pattern = `(?:${esc}|${csi})[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`;
        this.ansiRegex = new RegExp(pattern, 'g');
    }

    private stripAnsi(line: string): string {
        return line.replace(this.ansiRegex, '').trim();
    }

    private extractFrontmatterName(skillManifestPath: string): string | null {
        try {
            const raw = fs.readFileSync(skillManifestPath, 'utf8');
            // Match the first frontmatter block and read `name: ...`
            const frontmatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) return null;
            const body = frontmatterMatch[1];
            const nameMatch = body.match(/^\s*name\s*:\s*["']?([^"'\n]+)["']?\s*$/m);
            if (!nameMatch) return null;
            const name = nameMatch[1].trim();
            return name || null;
        } catch {
            return null;
        }
    }

    private resolveSkillDirByManifestName(candidates: string[]): string | null {
        const skillsRoot = path.join(this.workDir, 'skills');
        if (!fs.existsSync(skillsRoot)) return null;

        const wanted = new Set(
            candidates
                .map((v) => v.trim().toLowerCase())
                .filter((v) => v.length > 0),
        );
        if (wanted.size === 0) return null;

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
        } catch {
            return null;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillDir = path.join(skillsRoot, entry.name);
            const skillManifestPath = path.join(skillDir, 'SKILL.md');
            if (!fs.existsSync(skillManifestPath)) continue;

            const frontmatterName = this.extractFrontmatterName(skillManifestPath);
            if (!frontmatterName) continue;
            if (wanted.has(frontmatterName.toLowerCase())) {
                return skillDir;
            }
        }
        return null;
    }

    /**
     * Run a ClawHub CLI command
     */
    private async runCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.useNodeRunner && !fs.existsSync(this.cliEntryPath)) {
                reject(new Error(`ClawHub CLI entry not found at: ${this.cliEntryPath}`));
                return;
            }

            if (!this.useNodeRunner && !fs.existsSync(this.cliPath)) {
                reject(new Error(`ClawHub CLI not found at: ${this.cliPath}`));
                return;
            }

            // Build command arguments: [node, entry, --registry, url, ...args] or [clawhub, --registry, url, ...args]
            let commandArgs: string[];
            if (this.useNodeRunner) {
                commandArgs = [this.cliEntryPath];
            } else {
                commandArgs = [];
            }

            // Add registry flag if set (global option, applies to all commands)
            if (this._registry) {
                commandArgs.push('--registry', this._registry);
            }

            commandArgs.push(...args);

            const displayCommand = [this.useNodeRunner ? process.execPath : this.cliPath, ...commandArgs].join(' ');
            console.log(`Running ClawHub command: ${displayCommand}`);

            const isWin = process.platform === 'win32';
            const useShell = isWin && !this.useNodeRunner;
            const { NODE_OPTIONS: _nodeOptions, ...baseEnv } = process.env;
            const env = {
                ...baseEnv,
                CI: 'true',
                FORCE_COLOR: '0',
            };
            if (this.useNodeRunner) {
                env.ELECTRON_RUN_AS_NODE = '1';
            }
            const spawnCmd = useShell ? quoteForCmd(this.cliPath) : this.cliPath;
            const spawnArgs = useShell ? commandArgs.map(a => quoteForCmd(a)) : commandArgs;
            const child = spawn(spawnCmd, spawnArgs, {
                cwd: this.workDir,
                shell: useShell,
                env: {
                    ...env,
                    CLAWHUB_WORKDIR: this.workDir,
                },
                windowsHide: true,
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                console.error('ClawHub process error:', error);
                reject(error);
            });

            child.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    console.error(`ClawHub command failed with code ${code}`);
                    console.error('Stderr:', stderr);
                    reject(new Error(`Command failed: ${stderr || stdout}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Search for skills
     */
    async search(params: ClawHubSearchParams): Promise<ClawHubSkillResult[]> {
        // Set registry for this command
        if (params.registry !== undefined) {
            this._registry = params.registry;
        }

        try {
            // If query is empty, use 'explore' to show trending skills
            if (!params.query || params.query.trim() === '') {
                return this.explore({ limit: params.limit, registry: params.registry });
            }

            const args = ['search', params.query];
            if (params.limit) {
                args.push('--limit', String(params.limit));
            }

            const output = await this.runCommand(args);
            if (!output || output.includes('No skills found')) {
                return [];
            }

            const lines = output.split('\n').filter(l => l.trim());
            return lines.map(line => {
                const cleanLine = this.stripAnsi(line);

                // Format could be: slug vversion description (score)
                // Or sometimes: slug  vversion  description
                let match = cleanLine.match(/^(\S+)\s+v?(\d+\.\S+)\s+(.+)$/);
                if (match) {
                    const slug = match[1];
                    const version = match[2];
                    let description = match[3];

                    // Clean up score if present at the end
                    description = description.replace(/\(\d+\.\d+\)$/, '').trim();

                    return {
                        slug,
                        name: slug,
                        version,
                        description,
                    };
                }

                // Fallback for new clawhub search format without version:
                // slug  name/description  (score)
                match = cleanLine.match(/^(\S+)\s+(.+)$/);
                if (match) {
                    const slug = match[1];
                    let description = match[2];

                    // Clean up score if present at the end
                    description = description.replace(/\(\d+\.\d+\)$/, '').trim();

                    return {
                        slug,
                        name: slug,
                        version: 'latest', // Fallback version since it's not provided
                        description,
                    };
                }
                return null;
            }).filter((s): s is ClawHubSkillResult => s !== null);
        } catch (error) {
            console.error('ClawHub search error:', error);
            throw error;
        }
    }

    /**
     * Explore trending skills
     */
    async explore(params: ClawHubExploreParams = {}): Promise<ClawHubSkillResult[]> {
        // Set registry for this command
        if (params.registry !== undefined) {
            this._registry = params.registry;
        }

        try {
            const args = ['explore'];
            if (params.limit) {
                args.push('--limit', String(params.limit));
            }

            const output = await this.runCommand(args);
            if (!output) return [];

            const lines = output.split('\n').filter(l => l.trim());
            return lines.map(line => {
                const cleanLine = this.stripAnsi(line);

                // Format: slug vversion time description
                // Example: my-skill v1.0.0 2 hours ago A great skill
                const match = cleanLine.match(/^(\S+)\s+v?(\d+\.\S+)\s+(.+? ago|just now|yesterday)\s+(.+)$/i);
                if (match) {
                    return {
                        slug: match[1],
                        name: match[1],
                        version: match[2],
                        description: match[4],
                    };
                }
                return null;
            }).filter((s): s is ClawHubSkillResult => s !== null);
        } catch (error) {
            console.error('ClawHub explore error:', error);
            throw error;
        }
    }

    /**
     * Install a skill from COS bucket, with fallback to clawhub
     */
    async install(params: ClawHubInstallParams): Promise<void> {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const skillDir = path.join(this.workDir, 'skills', params.slug);
        const cosUrl = `https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills/${params.slug}.zip`;

        // Check if already installed
        if (fs.existsSync(skillDir) && !params.force) {
            console.log(`[ClawHubService] Skill ${params.slug} already installed, skipping`);
            return;
        }

        // Create skills directory
        ensureDir(path.join(this.workDir, 'skills'));

        // Remove existing if force
        if (fs.existsSync(skillDir) && params.force) {
            fs.rmSync(skillDir, { recursive: true, force: true });
        }

        const tempZip = path.join(this.workDir, '.clawhub', 'temp', `${params.slug}.zip`);
        const tempDir = path.dirname(tempZip);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Try COS bucket first
        try {
            console.log(`[ClawHubService] Trying COS bucket: ${cosUrl}`);
            await execAsync(`curl -fsSL "${cosUrl}" -o "${tempZip}"`);
            ensureDir(skillDir);
            await execAsync(`unzip -o "${tempZip}" -d "${skillDir}"`);
            fs.unlinkSync(tempZip);
            console.log(`[ClawHubService] Installed ${params.slug} from COS bucket`);
            return;
        } catch (cosError) {
            console.log(`[ClawHubService] COS bucket install failed, falling back to clawhub: ${cosError}`);
        }

        // Fall back to clawhub
        console.log(`[ClawHubService] Using clawhub to install ${params.slug}`);
        const args = ['install', params.slug];
        if (params.version) {
            args.push('--version', params.version);
        }
        if (params.force) {
            args.push('--force');
        }
        await this.runCommand(args);
    }

    /**
     * Uninstall a skill
     */
    async uninstall(params: ClawHubUninstallParams): Promise<void> {
        const fsPromises = fs.promises;

        // 1. Delete the skill directory
        const skillDir = path.join(this.workDir, 'skills', params.slug);
        if (fs.existsSync(skillDir)) {
            console.log(`Deleting skill directory: ${skillDir}`);
            await fsPromises.rm(skillDir, { recursive: true, force: true });
        }

        // 2. Remove from lock.json
        const lockFile = path.join(this.workDir, '.clawhub', 'lock.json');
        if (fs.existsSync(lockFile)) {
            try {
                const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
                if (lockData.skills && lockData.skills[params.slug]) {
                    console.log(`Removing ${params.slug} from lock.json`);
                    delete lockData.skills[params.slug];
                    await fsPromises.writeFile(lockFile, JSON.stringify(lockData, null, 2));
                }
            } catch (err) {
                console.error('Failed to update ClawHub lock file:', err);
            }
        }
    }

    /**
     * Update a skill to the latest version
     * First tries COS bucket, falls back to clawhub if not found (404)
     */
    async update(params: ClawHubUpdateParams): Promise<{ success: boolean; previousVersion?: string; newVersion?: string; error?: string }> {
        try {
            // Get current version before update
            const installed = await this.listInstalled();
            const currentSkill = installed.find(s => s.slug === params.slug);
            const previousVersion = currentSkill?.version;

            // Try COS bucket first
            const cosUrl = `https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills/${params.slug}.zip`;
            console.log(`[ClawHubService] Trying COS bucket: ${cosUrl}`);

            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const skillDir = path.join(this.workDir, 'skills', params.slug);
            const tempZip = path.join(this.workDir, '.clawhub', 'temp', `${params.slug}.zip`);

            // Ensure temp directory exists
            const tempDir = path.dirname(tempZip);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Remove existing skill directory if force
            if (fs.existsSync(skillDir) && params.force) {
                fs.rmSync(skillDir, { recursive: true, force: true });
            }

            try {
                // Download zip file from COS bucket
                await execAsync(`curl -fsSL "${cosUrl}" -o "${tempZip}"`);

                // Extract zip
                await execAsync(`unzip -o "${tempZip}" -d "${skillDir}"`);

                // Clean up
                fs.unlinkSync(tempZip);

                // Get new version from _meta.json
                let newVersion = previousVersion;
                const metaPath = path.join(skillDir, '_meta.json');
                if (fs.existsSync(metaPath)) {
                    try {
                        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        newVersion = meta.version || newVersion;
                    } catch {}
                }

                return {
                    success: true,
                    previousVersion,
                    newVersion,
                };
            } catch (cosError) {
                // COS download failed (likely 404), try clawhub as fallback
                console.log(`[ClawHubService] COS bucket download failed, falling back to clawhub: ${cosError}`);

                const args = ['update', params.slug];
                if (params.force) {
                    args.push('--force');
                }
                await this.runCommand(args);

                // Get new version after update
                const updated = await this.listInstalled();
                const updatedSkill = updated.find(s => s.slug === params.slug);
                const newVersion = updatedSkill?.version;

                return {
                    success: true,
                    previousVersion,
                    newVersion,
                };
            }
        } catch (error) {
            console.error('ClawHub update error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * List installed skills
     */
    async listInstalled(): Promise<ClawHubInstalledSkillResult[]> {
        try {
            const output = await this.runCommand(['list']);
            if (!output || output.includes('No installed skills')) {
                return [];
            }

            const lines = output.split('\n').filter(l => l.trim());
            return lines.map(line => {
                const cleanLine = this.stripAnsi(line);
                const match = cleanLine.match(/^(\S+)\s+v?(\d+\.\S+)/);
                if (match) {
                    const slug = match[1];
                    return {
                        slug,
                        version: match[2],
                        source: 'openclaw-managed',
                        baseDir: path.join(this.workDir, 'skills', slug),
                    };
                }
                return null;
            }).filter((s): s is ClawHubInstalledSkillResult => s !== null);
        } catch (error) {
            console.error('ClawHub list error:', error);
            return [];
        }
    }

    private resolveSkillDir(skillKeyOrSlug: string, fallbackSlug?: string, preferredBaseDir?: string): string | null {
        const candidates = [skillKeyOrSlug, fallbackSlug]
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map(v => v.trim());
        const uniqueCandidates = [...new Set(candidates)];
        if (preferredBaseDir && preferredBaseDir.trim() && fs.existsSync(preferredBaseDir.trim())) {
            return preferredBaseDir.trim();
        }
        const directSkillDir = uniqueCandidates
            .map((id) => path.join(this.workDir, 'skills', id))
            .find((dir) => fs.existsSync(dir));
        return directSkillDir || this.resolveSkillDirByManifestName(uniqueCandidates);
    }

    /**
     * Open skill README/manual in default editor
     */
    async openSkillReadme(skillKeyOrSlug: string, fallbackSlug?: string, preferredBaseDir?: string): Promise<boolean> {
        const skillDir = this.resolveSkillDir(skillKeyOrSlug, fallbackSlug, preferredBaseDir);

        // Try to find documentation file
        const possibleFiles = ['SKILL.md', 'README.md', 'skill.md', 'readme.md'];
        let targetFile = '';

        if (skillDir) {
            for (const file of possibleFiles) {
                const filePath = path.join(skillDir, file);
                if (fs.existsSync(filePath)) {
                    targetFile = filePath;
                    break;
                }
            }
        }

        if (!targetFile) {
            // If no md file, just open the directory
            if (skillDir) {
                targetFile = skillDir;
            } else {
                throw new Error('Skill directory not found');
            }
        }

        try {
            // Open file with default application
            await shell.openPath(targetFile);
            return true;
        } catch (error) {
            console.error('Failed to open skill readme:', error);
            throw error;
        }
    }

    /**
     * Open skill path in file explorer
     */
    async openSkillPath(skillKeyOrSlug: string, fallbackSlug?: string, preferredBaseDir?: string): Promise<boolean> {
        const skillDir = this.resolveSkillDir(skillKeyOrSlug, fallbackSlug, preferredBaseDir);
        if (!skillDir) {
            throw new Error('Skill directory not found');
        }
        const openResult = await shell.openPath(skillDir);
        if (openResult) {
            throw new Error(openResult);
        }
        return true;
    }
}
