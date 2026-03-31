/**
 * Skillhub Service
 * Manages interactions with Skillhub (skillhub.tencent.com) for skills management
 * Uses Tencent Cloud COS bucket for downloads
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { getOpenClawConfigDir, ensureDir } from '../utils/paths';

const SKILLHUB_INDEX_URL = 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills.json';
const SKILLHUB_DOWNLOAD_URL_TEMPLATE = 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills/{slug}.zip';

export interface SkillhubSkillInfo {
    slug: string;
    name: string;
    description: string;
    version: string;
    tags?: Record<string, string>;
    author?: string;
    downloads?: number;
    stars?: number;
}

export interface SkillhubInstalledSkillResult {
    slug: string;
    version: string;
    source?: string;
    baseDir?: string;
}

function httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                httpGet(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

export class SkillhubService {
    private workDir: string;
    private skillsIndex: SkillhubSkillInfo[] | null = null;
    private indexCacheTime: number = 0;
    private readonly INDEX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.workDir = getOpenClawConfigDir();
        ensureDir(this.workDir);
    }

    /**
     * Fetch skills index from COS bucket
     */
    async fetchIndex(): Promise<SkillhubSkillInfo[]> {
        const now = Date.now();
        if (this.skillsIndex && (now - this.indexCacheTime) < this.INDEX_CACHE_TTL) {
            return this.skillsIndex;
        }

        try {
            console.log(`[SkillhubService] Fetching skills index from ${SKILLHUB_INDEX_URL}`);
            const response = await httpGet(SKILLHUB_INDEX_URL);
            const data = JSON.parse(response);
            
            // Parse skills from the index
            if (Array.isArray(data)) {
                this.skillsIndex = data.map((skill: any) => ({
                    slug: skill.slug || skill.name,
                    name: skill.displayName || skill.name || skill.slug,
                    description: skill.summary || skill.description || '',
                    version: skill.tags?.latest || skill.version || '1.0.0',
                    author: skill.owner?.handle || skill.author,
                    downloads: skill.stats?.downloads,
                    stars: skill.stats?.stars,
                }));
            } else if (data.skills && Array.isArray(data.skills)) {
                this.skillsIndex = data.skills.map((skill: any) => ({
                    slug: skill.slug || skill.name,
                    name: skill.displayName || skill.name || skill.slug,
                    description: skill.summary || skill.description || '',
                    version: skill.tags?.latest || skill.version || '1.0.0',
                    author: skill.owner?.handle || skill.author,
                    downloads: skill.stats?.downloads,
                    stars: skill.stats?.stars,
                }));
            } else {
                this.skillsIndex = [];
            }
            
            this.indexCacheTime = now;
            return this.skillsIndex;
        } catch (error) {
            console.error('[SkillhubService] Failed to fetch index:', error);
            throw error;
        }
    }

    /**
     * Search skills by query
     */
    async search(query: string): Promise<SkillhubSkillInfo[]> {
        const index = await this.fetchIndex();
        const lowerQuery = query.toLowerCase();
        return index.filter(skill => 
            skill.slug.toLowerCase().includes(lowerQuery) ||
            skill.name.toLowerCase().includes(lowerQuery) ||
            skill.description.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Explore trending skills
     */
    async explore(limit: number = 20): Promise<SkillhubSkillInfo[]> {
        const index = await this.fetchIndex();
        // Sort by stars/downloads if available
        const sorted = [...index].sort((a, b) => {
            const starsA = a.stars || 0;
            const starsB = b.stars || 0;
            return starsB - starsA;
        });
        return sorted.slice(0, limit);
    }

    /**
     * Download and extract a skill zip
     */
    private async downloadSkill(slug: string, targetDir: string): Promise<void> {
        const zipUrl = SKILLHUB_DOWNLOAD_URL_TEMPLATE.replace('{slug}', slug);
        console.log(`[SkillhubService] Downloading ${slug} from ${zipUrl}`);

        try {
            const response = await httpGet(zipUrl);
            
            // Write to temp file first
            const tempZipPath = path.join(this.workDir, '.skillhub', 'temp', `${slug}.zip`);
            const tempDir = path.dirname(tempZipPath);
            ensureDir(tempDir);
            
            fs.writeFileSync(tempZipPath, response);
            
            // Extract zip
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            // Use unzip if available, otherwise use python
            try {
                await execAsync(`unzip -o "${tempZipPath}" -d "${targetDir}"`);
            } catch {
                // Fallback to python zipfile
                const pythonScript = `
import zipfile
import os
zip_path = "${tempZipPath}"
extract_to = "${targetDir}"
os.makedirs(extract_to, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_to)
print("Extracted successfully")
`;
                await execAsync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`);
            }
            
            // Clean up temp file
            fs.unlinkSync(tempZipPath);
            
            console.log(`[SkillhubService] Downloaded and extracted ${slug} to ${targetDir}`);
        } catch (error) {
            console.error(`[SkillhubService] Failed to download ${slug}:`, error);
            throw error;
        }
    }

    /**
     * Install a skill
     */
    async install(params: { slug: string; version?: string; force?: boolean }): Promise<void> {
        const skillDir = path.join(this.workDir, 'skills', params.slug);
        
        // Check if already installed
        if (fs.existsSync(skillDir) && !params.force) {
            console.log(`[SkillhubService] Skill ${params.slug} already installed, skipping`);
            return;
        }

        // Create skills directory
        ensureDir(path.join(this.workDir, 'skills'));
        
        // Remove existing if force
        if (fs.existsSync(skillDir) && params.force) {
            fs.rmSync(skillDir, { recursive: true, force: true });
        }

        await this.downloadSkill(params.slug, skillDir);
    }

    /**
     * Update a skill to latest version
     */
    async update(params: { slug: string; version?: string }): Promise<{ success: boolean; previousVersion?: string; newVersion?: string; error?: string }> {
        const skillDir = path.join(this.workDir, 'skills', params.slug);
        
        // Get current version
        let previousVersion: string | undefined;
        const metaPath = path.join(skillDir, '_meta.json');
        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                previousVersion = meta.version;
            } catch {}
        }

        try {
            // Re-read index to get latest version
            this.skillsIndex = null; // Force refresh
            const index = await this.fetchIndex();
            const skillInfo = index.find(s => s.slug === params.slug);
            const newVersion = skillInfo?.version || params.version || 'latest';

            // Download latest version
            await this.install({ slug: params.slug, version: newVersion, force: true });

            return {
                success: true,
                previousVersion,
                newVersion,
            };
        } catch (error) {
            return {
                success: false,
                previousVersion,
                error: String(error),
            };
        }
    }

    /**
     * List installed skills
     */
    async listInstalled(): Promise<SkillhubInstalledSkillResult[]> {
        const skillsDir = path.join(this.workDir, 'skills');
        
        if (!fs.existsSync(skillsDir)) {
            return [];
        }

        const results: SkillhubInstalledSkillResult[] = [];
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillDir = path.join(skillsDir, entry.name);
            const metaPath = path.join(skillDir, '_meta.json');
            
            let version = 'unknown';
            if (fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    version = meta.version || 'unknown';
                } catch {}
            }

            results.push({
                slug: entry.name,
                version,
                source: 'skillhub',
                baseDir: skillDir,
            });
        }

        return results;
    }
}
