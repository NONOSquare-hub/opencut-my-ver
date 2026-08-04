// Silent WAV 1-second audio loop data URI to trick browser audio engine into keeping background tab active
const SILENT_WAV_URI =
	"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export class BackgroundExportKeeper {
	private wakeLock: WakeLockSentinel | null = null;
	private audioCtx: AudioContext | null = null;
	private audioElement: HTMLAudioElement | null = null;
	private isRunning = false;

	private handleVisibilityChange = () => {
		if (typeof document !== "undefined" && document.visibilityState === "visible" && this.isRunning) {
			void this.requestWakeLock();
		}
	};

	async start(): Promise<void> {
		if (this.isRunning) return;
		this.isRunning = true;

		// 1. Request Screen WakeLock if supported
		await this.requestWakeLock();
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", this.handleVisibilityChange);
		}

		// 2. Play silent HTML5 Audio element to prevent Chromium from throttling hidden tab
		try {
			if (typeof Audio !== "undefined") {
				this.audioElement = new Audio(SILENT_WAV_URI);
				this.audioElement.loop = true;
				this.audioElement.volume = 0.001; // Extremely faint, effectively silent
				await this.audioElement.play().catch(() => {});
			}
		} catch (error) {
			console.warn("Could not start HTML5 audio keep-alive:", error);
		}

		// 3. Start a Web Audio context to double-ensure audio activity
		try {
			if (typeof window !== "undefined") {
				const AudioContextClass =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				if (AudioContextClass) {
					this.audioCtx = new AudioContextClass();
					const osc = this.audioCtx.createOscillator();
					const gain = this.audioCtx.createGain();

					gain.gain.value = 0.00001;
					osc.connect(gain);
					gain.connect(this.audioCtx.destination);
					osc.start();

					if (this.audioCtx.state === "suspended") {
						await this.audioCtx.resume().catch(() => {});
					}
				}
			}
		} catch (error) {
			console.warn("Could not start background Web Audio keep-alive:", error);
		}
	}

	private async requestWakeLock(): Promise<void> {
		if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
			try {
				this.wakeLock = await navigator.wakeLock.request("screen");
			} catch {
				// WakeLock may fail if tab is not focused or not supported
			}
		}
	}

	stop(): void {
		if (!this.isRunning) return;
		this.isRunning = false;

		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.handleVisibilityChange);
		}

		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement.src = "";
			this.audioElement = null;
		}

		if (this.wakeLock) {
			this.wakeLock.release().catch(() => {});
			this.wakeLock = null;
		}

		if (this.audioCtx) {
			this.audioCtx.close().catch(() => {});
			this.audioCtx = null;
		}
	}
}
