/**
 * pack-electron.js — Build script for OpenCut Classic Installer
 *
 * Steps:
 *  1. Detect Bun executable
 *  2. Build Next.js in standalone mode
 *  3. Validate .next/standalone/server.js exists
 *  4. Copy static + public assets into standalone
 *  5. Run electron-builder to produce NSIS installer
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

// ─── Console helpers ───────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function log(msg) { console.log(`${c.gray}  ${msg}${c.reset}`); }
function ok(msg) { console.log(`${c.green}  ✅ ${msg}${c.reset}`); }
function warn(msg) { console.log(`${c.yellow}  ⚠️  ${msg}${c.reset}`); }
function fail(msg) { console.error(`${c.red}${c.bold}  ❌ ${msg}${c.reset}`); }
function step(n, total, msg) { console.log(`\n${c.cyan}${c.bold}[${n}/${total}] ${msg}${c.reset}`); }
function hr() { console.log(`${c.gray}${'─'.repeat(60)}${c.reset}`); }

// ─── Detect Bun ────────────────────────────────────────────────────────────────
function findBun() {
    // 1. Try PATH first (most reliable)
    try {
        const result = execSync('where bun', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const p = result.trim().split('\n')[0].trim();
        if (p && fs.existsSync(p)) {
            log(`Found Bun in PATH: ${p}`);
            return p;
        }
    } catch (_) {}

    // 2. Common Windows install locations
    const candidates = [
        path.join(process.env.USERPROFILE || '', '.bun', 'bin', 'bun.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'bun', 'bun.exe'),
        'C:\\bun\\bun.exe',
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            log(`Found Bun at: ${p}`);
            return p;
        }
    }

    return null;
}

// ─── Wait helper ───────────────────────────────────────────────────────────────
function sleep(ms) {
    execSync(`powershell -Command "Start-Sleep -Milliseconds ${ms}"`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function pack() {
    const TOTAL_STEPS = 5;
    const webDir = __dirname; // apps/web/

    hr();
    console.log(`${c.bold}${c.cyan}  🚀 OpenCut Classic — Build Installer${c.reset}`);
    hr();

    // ── Step 1: Find Bun ──────────────────────────────────────────────────────
    step(1, TOTAL_STEPS, 'Detecting Bun runtime...');
    const bunPath = findBun();
    if (!bunPath) {
        fail('Bun not found. Please install Bun from https://bun.sh');
        fail('Then restart your terminal and try again.');
        process.exit(1);
    }
    ok(`Bun: ${bunPath}`);
    try {
        const version = execSync(`"${bunPath}" --version`, { encoding: 'utf8' }).trim();
        ok(`Bun version: ${version}`);
    } catch (_) {}

    // ── Step 2: Build Next.js ─────────────────────────────────────────────────
    step(2, TOTAL_STEPS, 'Building Next.js (standalone mode)...');
    log('This may take 2–5 minutes. Please wait...');
    try {
        execSync(`"${bunPath}" run build`, {
            cwd: webDir,
            stdio: 'inherit',
            timeout: 10 * 60 * 1000, // 10 min
        });
        ok('Next.js build complete.');
    } catch (e) {
        fail('Next.js build failed. See errors above.');
        fail('Common causes:');
        fail('  - Missing .env.local variables');
        fail('  - TypeScript / import errors in source code');
        process.exit(1);
    }

    // ── Step 3: Validate standalone output ────────────────────────────────────
    step(3, TOTAL_STEPS, 'Validating build output...');
    const standaloneDir = path.join(webDir, '.next', 'standalone');

    if (!fs.existsSync(standaloneDir)) {
        fail('`.next/standalone` directory not found after build!');
        fail('Make sure next.config.ts has: output: "standalone"');
        process.exit(1);
    }
    ok('".next/standalone" directory exists.');

    // In a monorepo, Next.js nests server.js under the workspace path
    // e.g. standalone/apps/web/server.js instead of standalone/server.js
    const serverJsCandidates = [
        path.join(standaloneDir, 'server.js'),
        path.join(standaloneDir, 'apps', 'web', 'server.js'),
    ];
    const serverJs = serverJsCandidates.find(p => fs.existsSync(p));
    if (!serverJs) {
        fail('"server.js" not found inside standalone directory!');
        fail('Checked locations:');
        serverJsCandidates.forEach(p => fail(`  ${p}`));
        process.exit(1);
    }
    // The actual app root inside standalone (may differ in monorepo)
    const standaloneAppDir = path.dirname(serverJs);
    ok(`"server.js" found at: ${serverJs}`);

    // ── Step 4: Copy static assets ────────────────────────────────────────────
    step(4, TOTAL_STEPS, 'Copying static & public assets into standalone...');

    // Static and public must be copied alongside server.js (inside standaloneAppDir)
    const staticSrc = path.join(webDir, '.next', 'static');
    const staticDst = path.join(standaloneAppDir, '.next', 'static');
    if (fs.existsSync(staticSrc)) {
        fs.copySync(staticSrc, staticDst, { overwrite: true });
        ok(`Copied: .next/static → ${path.relative(webDir, staticDst)}`);
    } else {
        warn('`.next/static` not found — skipping (may affect CSS/JS loading).');
    }

    const publicSrc = path.join(webDir, 'public');
    const publicDst = path.join(standaloneAppDir, 'public');
    if (fs.existsSync(publicSrc)) {
        fs.copySync(publicSrc, publicDst, { overwrite: true });
        ok(`Copied: public/ → ${path.relative(webDir, publicDst)}`);
    } else {
        warn('`public/` not found — skipping.');
    }

    // ── Step 5: Run electron-builder ──────────────────────────────────────────
    step(5, TOTAL_STEPS, 'Running electron-builder to package installer...');
    log('Building Windows NSIS installer (.exe)...');

    // Output to C:\temp\opencut-dist instead of E:\... to avoid NTFS rename
    // EPERM errors that occur consistently when the project is on a secondary
    // drive (E:, D:, etc.) which may have restricted ACLs for atomic renames.
    const outDir = 'C:\\temp\\opencut-dist';
    fs.ensureDirSync(outDir);
    log(`Output directory: ${outDir}`);

    const distDir = path.join(webDir, 'dist');
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        log(`Attempt ${attempt}/${maxAttempts}...`);

        // Clean previous unpacked dirs inside the output dir
        const toClean = [
            path.join(outDir, 'win-unpacked.tmp'),
            path.join(outDir, 'win-unpacked'),
        ];
        for (const p of toClean) {
            if (fs.existsSync(p)) {
                log(`Cleaning: ${p}`);
                try { fs.removeSync(p); } catch (e) {
                    warn(`Could not remove ${p}: ${e.message}`);
                }
            }
        }

        try {
            execSync(
                `"${bunPath}" run electron-builder --win --config.extraMetadata.main=electron/main.js --config.directories.output="${outDir}"`,
                {
                    cwd: webDir,
                    stdio: 'inherit',
                    timeout: 15 * 60 * 1000,
                }
            );
            ok('electron-builder completed successfully!');
            break;
        } catch (e) {
            fail(`electron-builder failed on attempt ${attempt}.`);
            if (attempt >= maxAttempts) {
                fail('All attempts exhausted.');
                fail('Common causes:');
                fail('  - No internet connection (electron binary download failed)');
                fail('  - Ổ đĩa C: đầy (cần ~500MB trống tại C:\\temp\\opencut-dist)');
                fail('  - Missing NSIS: install from https://nsis.sourceforge.io/');

                process.exit(1);
            }
            warn('Waiting 5 seconds before retry (helps bypass Windows Defender lock)...');
            sleep(5000);
        }
    }

    // ── Done ──────────────────────────────────────────────────────────────────
    hr();
    console.log(`${c.green}${c.bold}  🎉 BUILD COMPLETE!${c.reset}`);
    if (fs.existsSync(outDir)) {
        const files = fs.readdirSync(outDir).filter(f => f.endsWith('.exe'));
        if (files.length > 0) {
            files.forEach(f => {
                const size = (fs.statSync(path.join(outDir, f)).size / 1024 / 1024).toFixed(1);
                ok(`Installer: ${outDir}\\${f}  (${size} MB)`);
            });
        }
    } else {
        ok(`Output directory: ${outDir}`);
    }
    hr();
}

pack().catch(err => {
    fail(`Unexpected error: ${err.message}`);
    process.exit(1);
});
