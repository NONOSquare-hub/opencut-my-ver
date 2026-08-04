const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	selectDataDirectory: () => ipcRenderer.invoke("select-data-directory"),
	getDataDirectory: () => ipcRenderer.invoke("get-data-directory"),
	setExportProgress: (progress) => ipcRenderer.send("set-export-progress", progress),
});
