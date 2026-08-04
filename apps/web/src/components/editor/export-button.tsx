"use client";

import { useState } from "react";
import { TransitionTopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/utils/ui";
import {
	getExportMimeType,
	getExportFileExtension,
	downloadBuffer,
	EXPORT_FORMAT_VALUES,
	EXPORT_QUALITY_VALUES,
	type ExportFormat,
	type ExportQuality,
} from "@/export";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import { StreamTarget, type Target } from "mediabunny";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { useEditor } from "@/editor/use-editor";
import { DEFAULT_EXPORT_OPTIONS } from "@/export/defaults";

function isExportFormat(value: string): value is ExportFormat {
	return EXPORT_FORMAT_VALUES.some((formatValue) => formatValue === value);
}

function isExportQuality(value: string): value is ExportQuality {
	return EXPORT_QUALITY_VALUES.some((qualityValue) => qualityValue === value);
}

function formatExportDuration(milliseconds: number | null): string {
	if (milliseconds === null || !Number.isFinite(milliseconds)) {
		return "Calculating...";
	}

	const totalSeconds = Math.max(Math.round(milliseconds / 1000), 0);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ExportButton() {
	const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const hasProject = !!activeProject;

	const handlePopoverOpenChange = ({ open }: { open: boolean }) => {
		if (!open) {
			const { isExporting } = editor.project.getExportState();
			if (!isExporting) {
				editor.project.clearExportState();
			}
		}
		setIsExportPopoverOpen(open);
	};

	return (
		<Popover
			open={isExportPopoverOpen}
			onOpenChange={(open) => handlePopoverOpenChange({ open })}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-1.5 rounded-md bg-[#38BDF8] px-[0.12rem] py-[0.12rem] text-white",
						hasProject ? "cursor-pointer" : "cursor-not-allowed opacity-50",
					)}
					onClick={hasProject ? () => setIsExportPopoverOpen(true) : undefined}
					disabled={!hasProject}
					onKeyDown={(event) => {
						if (hasProject && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							setIsExportPopoverOpen(true);
						}
					}}
				>
					<div className="relative flex items-center gap-1.5 rounded-[0.6rem] bg-linear-270 from-[#2567EC] to-[#37B6F7] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
						<HugeiconsIcon icon={TransitionTopIcon} className="z-50 size-3.5" />
						<span className="z-50 text-[0.875rem]">Export</span>
						<div className="absolute top-0 left-0 z-10 flex size-full items-center justify-center rounded-[0.6rem] bg-linear-to-t from-white/0 to-white/50">
							<div className="absolute top-[0.08rem] z-50 h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[0.6rem] bg-linear-270 from-[#2567EC] to-[#37B6F7]"></div>
						</div>
					</div>
				</button>
			</PopoverTrigger>
			{hasProject && <ExportPopover onOpenChange={setIsExportPopoverOpen} />}
		</Popover>
	);
}

function ExportPopover({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const exportState = useEditor((e) => e.project.getExportState());
	const {
		isExporting,
		activeExportCount,
		elapsedMs,
		estimatedRemainingMs,
		progress,
		result: exportResult,
	} = exportState;
	const [format, setFormat] = useState<ExportFormat>(
		DEFAULT_EXPORT_OPTIONS.format,
	);
	const [quality, setQuality] = useState<ExportQuality>(
		DEFAULT_EXPORT_OPTIONS.quality,
	);
	const [shouldIncludeAudio, setShouldIncludeAudio] = useState<boolean>(
		DEFAULT_EXPORT_OPTIONS.includeAudio ?? true,
	);
	const [isParallel, setIsParallel] = useState<boolean>(true);

	const handleExport = async () => {
		if (!activeProject || isExporting) return;

		editor.project.startExporting();

		let target: Target | undefined = undefined;
		let isStreamDirect = false;
		let fileWritable: any = null;

		if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
			try {
				const ext = getExportFileExtension({ format });
				const mime = getExportMimeType({ format });
				const handle = await (
					window as unknown as {
						showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
					}
				).showSaveFilePicker({
					suggestedName: `${activeProject.metadata.name}${ext}`,
					types: [
						{
							description: format === "mp4" ? "MP4 Video File" : "WebM Video File",
							accept: { [mime]: [ext] },
						},
					],
				});

				fileWritable = await handle.createWritable();
				target = new StreamTarget(fileWritable, {
					chunked: true,
					chunkSize: 16 * 1024 * 1024,
				});
				isStreamDirect = true;
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					editor.project.clearExportState();
					return;
				}
				console.warn("Direct file stream picking unavailable, falling back to buffer target:", err);
			}
		}

		try {
			const result = await editor.project.export({
				options: {
					format,
					quality,
					fps: activeProject.settings.fps,
					includeAudio: shouldIncludeAudio,
					target,
					parallel: isParallel,
				},
			});

			if (fileWritable) {
				try {
					await fileWritable.close();
				} catch (e) {
					console.warn("Failed to close fileWritable:", e);
				}
				fileWritable = null;
			}

			if (result.cancelled) {
				editor.project.clearExportState();
				return;
			}

			if (result.success) {
				if (!isStreamDirect && result.buffer && result.buffer.byteLength > 0) {
					downloadBuffer({
						buffer: result.buffer,
						filename: `${activeProject.metadata.name}${getExportFileExtension({ format })}`,
						mimeType: getExportMimeType({ format }),
					});
				}

				editor.project.clearExportState();
				onOpenChange(false);
			}
		} finally {
			if (fileWritable) {
				try {
					await fileWritable.close();
				} catch (e) {
					// Ignore if already closed
				}
			}
		}
	};

	const handleCancel = () => {
		editor.project.cancelExport();
	};

	return (
		<PopoverContent className="bg-background mr-4 flex w-80 flex-col p-0">
			{exportResult && !exportResult.success ? (
				<ExportError
					error={exportResult.error || "Unknown error occurred"}
					onRetry={handleExport}
				/>
			) : (
				<>
					<div className="flex items-center justify-between border-b p-3">
						<div className="flex flex-col gap-1">
							<h3 className="font-medium text-sm">
								{isExporting ? "Exporting project" : "Export project"}
							</h3>
							<p className="text-muted-foreground text-xs">
								Active exports: {activeExportCount}
							</p>
						</div>
					</div>

					<div className="flex flex-col gap-4">
						{!isExporting && (
							<>
								<div className="flex flex-col">
									<Section
										collapsible
										defaultOpen={false}
										showTopBorder={false}
									>
										<SectionHeader>
											<SectionTitle>Format</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={format}
												onValueChange={(value) => {
													if (isExportFormat(value)) {
														setFormat(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="mp4" id="mp4" />
													<Label htmlFor="mp4">
														MP4 (H.264) - Better compatibility
													</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="webm" id="webm" />
													<Label htmlFor="webm">
														WebM (VP9) - Smaller file size
													</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>Quality</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={quality}
												onValueChange={(value) => {
													if (isExportQuality(value)) {
														setQuality(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="low" id="low" />
													<Label htmlFor="low">Low - Smallest file size</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="medium" id="medium" />
													<Label htmlFor="medium">Medium - Balanced</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="high" id="high" />
													<Label htmlFor="high">High - Recommended</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="very_high" id="very_high" />
													<Label htmlFor="very_high">
														Very high - Largest file size
													</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>Audio</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<div className="flex items-center space-x-2">
												<Checkbox
													id="include-audio"
													checked={shouldIncludeAudio}
													onCheckedChange={(checked) =>
														setShouldIncludeAudio(!!checked)
													}
												/>
												<Label htmlFor="include-audio">
													Include audio in export
												</Label>
											</div>
										</SectionContent>
									</Section>

									<div className="p-3 border-t flex flex-col gap-1.5 bg-muted/20">
										<div className="flex items-center space-x-2">
											<Checkbox
												id="parallel-export"
												checked={isParallel}
												onCheckedChange={(checked) =>
													setIsParallel(!!checked)
												}
											/>
											<Label
												htmlFor="parallel-export"
												className="font-medium text-xs flex items-center gap-1 cursor-pointer"
											>
												⚡ Tăng tốc đa luồng (Turbo GPU)
											</Label>
										</div>
										<p className="text-[11px] text-muted-foreground leading-tight pl-6">
											Tận dụng tối đa công suất CPU & GPU để xuất video nhanh hơn 2–3 lần. Hoàn toàn an toàn cho thiết bị.
										</p>
									</div>
								</div>

								<div className="p-3 pt-0">
									<Button
										onClick={handleExport}
										disabled={isExporting}
										className="w-full gap-2"
									>
										<Download className="size-4" />
										{isExporting ? "Export in progress" : "Export"}
									</Button>
								</div>
							</>
						)}

						{isExporting && (
							<div className="space-y-4 p-3">
								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between text-center">
										<p className="text-muted-foreground text-sm">
											{Math.round(progress * 100)}%
										</p>
										<p className="text-muted-foreground text-sm">
											{activeExportCount} running
										</p>
										<p className="text-muted-foreground text-sm">100%</p>
									</div>
									<Progress value={progress * 100} className="w-full" />
									<div className="text-muted-foreground flex items-center justify-between text-xs">
										<span>Elapsed: {formatExportDuration(elapsedMs)}</span>
										<span>
											Remaining: {progress <= 0.01 ? "Preparing audio & media..." : formatExportDuration(estimatedRemainingMs)}
										</span>
									</div>
								</div>

								<Button
									variant="outline"
									className="w-full rounded-md"
									onClick={handleCancel}
								>
									Stop export
								</Button>
							</div>
						)}
					</div>
				</>
			)}
		</PopoverContent>
	);
}

function ExportError({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(error);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="space-y-4 p-3">
			<div className="flex flex-col gap-1.5">
				<p className="text-destructive text-sm font-medium">Export failed</p>
				<p className="text-muted-foreground text-xs">{error}</p>
			</div>

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={handleCopy}
				>
					{copied ? <Check className="text-constructive" /> : <Copy />}
					Copy
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={onRetry}
				>
					<RotateCcw />
					Retry
				</Button>
			</div>
		</div>
	);
}
