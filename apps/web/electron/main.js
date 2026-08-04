const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Root storage configuration file
const configPath = path.join(__dirname, "../../../storage-config.json");
const defaultDriveDataPath = path.join(__dirname, "../../../data");

let customDataPath = null;

if (fs.existsSync(configPath)) {
	try {
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		if (config.dataPath && typeof config.dataPath === "string") {
			customDataPath = config.dataPath;
		}
	} catch (e) {
		console.warn("Failed to parse storage-config.json:", e);
	}
}

if (!customDataPath) {
	customDataPath = defaultDriveDataPath;
}

const tempDir = path.join(customDataPath, "temp");
const cacheDir = path.join(customDataPath, "cache");

try {
	if (!fs.existsSync(customDataPath)) {
		fs.mkdirSync(customDataPath, { recursive: true });
	}
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true });
	}
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}
	app.setPath("userData", customDataPath);
	app.setPath("temp", tempDir);
	process.env.TMP = tempDir;
	process.env.TEMP = tempDir;
} catch (e) {
	console.warn("Failed to set custom userData/temp path, falling back to default:", e);
}

// Redirect Chromium disk cache to custom storage drive (e.g. Drive E:)
app.commandLine.appendSwitch("disk-cache-dir", cacheDir);

// Hardware acceleration & WebCodecs flags for high-performance video editing & export
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");

// Prevent Chromium from freezing/white-screening backgrounded or occluded windows when minimized
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion,CalculateNativeWinOcclusionWindowGroup,IntensiveWakeUpThrottling");

let mainWindow = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 728,
		title: "OpenCut Classic - Video Editor",
		icon: path.join(__dirname, "../public/favicon.ico"),
		autoHideMenuBar: true,
		backgroundColor: "#090D16", // Sleek dark theme matching OpenCut UI (prevents white screen flash)
		show: false, // Hidden until content is loaded to eliminate white startup screen
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: true,
			backgroundThrottling: false, // Prevents background CPU/timer throttling during export
		},
	});

	Menu.setApplicationMenu(null);

	const targetUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
	
	let hasShown = false;
	const loadWithRetry = (url, retries = 15) => {
		if (!mainWindow) return;
		mainWindow.loadURL(url).catch((err) => {
			if (retries > 0) {
				setTimeout(() => loadWithRetry(url, retries - 1), 1000);
			} else {
				console.error("Failed to load OpenCut server URL:", err);
				if (!hasShown && mainWindow) {
					hasShown = true;
					mainWindow.show();
				}
			}
		});
	};

	mainWindow.once("ready-to-show", () => {
		if (!hasShown && mainWindow) {
			hasShown = true;
			mainWindow.show();
		}
	});

	loadWithRetry(targetUrl);

	// Auto-recover if WebGL/Renderer process crashes or becomes unresponsive after prolonged idle
	mainWindow.webContents.on("render-process-gone", (event, details) => {
		console.warn("[Electron] Renderer process gone after idle:", details.reason);
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.reload();
		}
	});

	mainWindow.webContents.on("unresponsive", () => {
		console.warn("[Electron] Window unresponsive after idle, reloading...");
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.reload();
		}
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			shell.openExternal(url);
			return { action: "deny" };
		}
		return { action: "allow" };
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

// Handle IPC folder picker requests from frontend UI
ipcMain.handle("select-data-directory", async () => {
	if (!mainWindow) return null;
	const result = await dialog.showOpenDialog(mainWindow, {
		title: "Chọn thư mục/ổ đĩa để lưu trữ dữ liệu dự án OpenCut",
		defaultPath: customDataPath,
		properties: ["openDirectory", "createDirectory"],
	});
	if (!result.canceled && result.filePaths.length > 0) {
		const newPath = result.filePaths[0];
		try {
			fs.writeFileSync(configPath, JSON.stringify({ dataPath: newPath }, null, 2));
		} catch (err) {
			console.error("Failed to write storage-config.json:", err);
		}
		return newPath;
	}
	return null;
});

ipcMain.handle("get-data-directory", async () => {
	return app.getPath("userData");
});

// Update taskbar icon progress bar during video export
ipcMain.on("set-export-progress", (event, progress) => {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	if (typeof progress === "number" && progress >= 0 && progress < 1) {
		mainWindow.setProgressBar(progress);
	} else {
		mainWindow.setProgressBar(-1);
	}
});

app.whenReady().then(() => {
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
