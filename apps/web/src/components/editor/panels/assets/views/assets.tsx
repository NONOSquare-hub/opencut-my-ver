"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { MediaDragOverlay } from "@/components/editor/panels/assets/drag-overlay";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/timeline/creation";
import { addMediaTime, mediaTimeFromSeconds, type MediaTime } from "@/wasm";
import { useEditor } from "@/editor/use-editor";
import { useFileUpload } from "@/media/use-file-upload";
import { invokeAction } from "@/actions";
import { processMediaAssets } from "@/media/processing";
import { showMediaUploadToast } from "@/media/upload-toast";
import {
	SelectableItem,
	SelectableSurface,
	useSelection,
	useSelectionScope,
} from "@/selection";
import { buildElementFromMedia } from "@/timeline/element-utils";
import {
	type MediaSortKey,
	type MediaSortOrder,
	type MediaViewMode,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import { MASKABLE_ELEMENT_TYPES } from "@/timeline";
import type { MediaAsset } from "@/media/types";
import { cn } from "@/utils/ui";
import {
	CloudUploadIcon,
	GridViewIcon,
	LeftToRightListDashIcon,
	SortingOneNineIcon,
	Image02Icon,
	MusicNote03Icon,
	Video01Icon,
	DragDropVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export function MediaView() {
	const editor = useEditor();
	const mediaFiles = useEditor((e) => e.media.getAssets());
	const activeProject = useEditor((e) => e.project.getActive());

	const {
		mediaViewMode,
		setMediaViewMode,
		highlightMediaId,
		clearHighlight,
		mediaSortBy,
		mediaSortOrder,
		setMediaSort,
	} = useAssetsPanelStore();

	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [mergeOrderIds, setMergeOrderIds] = useState<string[]>([]);

	const processFiles = async ({ files }: { files: File[] }) => {
		if (!files || files.length === 0) return;
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		try {
			await showMediaUploadToast({
				filesCount: files.length,
				promise: async () => {
					const processedAssets = await processMediaAssets({
						files,
						onProgress: (progress: { progress: number }) =>
							setProgress(progress.progress),
					});
					for (const asset of processedAssets) {
						await editor.media.addMediaAsset({
							projectId: activeProject.metadata.id,
							asset,
						});
					}
					return {
						uploadedCount: processedAssets.length,
						assetNames: processedAssets.map((asset) => asset.name),
					};
				},
			});
		} catch (error) {
			console.error("Error processing files:", error);
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const { isDragOver, dragProps, openFilePicker, fileInputProps } =
		useFileUpload({
			accept: "image/*,video/*,audio/*",
			multiple: true,
			onFilesSelected: (files) => processFiles({ files }),
		});

	const handleRemove = ({
		event,
		ids,
	}: {
		event: React.MouseEvent;
		ids: string[];
	}) => {
		event.stopPropagation();

		invokeAction("remove-media-assets", {
			projectId: activeProject.metadata.id,
			assetIds: ids,
		});
	};

	const handleSort = ({ key }: { key: MediaSortKey }) => {
		if (mediaSortBy === key) {
			setMediaSort({
				key,
				order: mediaSortOrder === "asc" ? "desc" : "asc",
			});
		} else {
			setMediaSort({ key, order: "asc" });
		}
	};

	const filteredMediaItems = useMemo(() => {
		const filtered = mediaFiles.filter((item) => !item.ephemeral);

		filtered.sort((a, b) => {
			let valueA: string | number;
			let valueB: string | number;

			switch (mediaSortBy) {
				case "name":
					valueA = a.name.toLowerCase();
					valueB = b.name.toLowerCase();
					break;
				case "type":
					valueA = a.type;
					valueB = b.type;
					break;
				case "duration":
					valueA = a.duration || 0;
					valueB = b.duration || 0;
					break;
				case "size":
					valueA = a.file.size;
					valueB = b.file.size;
					break;
				default:
					return 0;
			}

			if (valueA < valueB) return mediaSortOrder === "asc" ? -1 : 1;
			if (valueA > valueB) return mediaSortOrder === "asc" ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [mediaFiles, mediaSortBy, mediaSortOrder]);
	const orderedMediaIds = useMemo(() => {
		return filteredMediaItems.map((item) => item.id);
	}, [filteredMediaItems]);

	const handleMergeVideos = ({ assets }: { assets: MediaAsset[] }) => {
		if (assets.length < 2) {
			toast.error("Select at least 2 videos to merge");
			return;
		}

		let nextStartTime = editor.timeline.getTotalDuration();

		for (const asset of assets) {
			const duration =
				asset.duration != null
					? mediaTimeFromSeconds({ seconds: asset.duration })
					: DEFAULT_NEW_ELEMENT_DURATION;
			const element = buildElementFromMedia({
				mediaId: asset.id,
				mediaType: asset.type,
				name: asset.name,
				duration,
				startTime: nextStartTime,
			});

			editor.timeline.insertElement({
				element,
				placement: { mode: "auto", trackType: "video" },
			});
			nextStartTime = addMediaTime({ a: nextStartTime, b: duration });
		}

		toast.success(`Added ${assets.length} videos to the timeline`);
	};

	return (
		<>
			<input {...fileInputProps} />

			<PanelView
				title="Assets"
				actions={
					<MediaActions
						mediaViewMode={mediaViewMode}
						setMediaViewMode={setMediaViewMode}
						isProcessing={isProcessing}
						sortBy={mediaSortBy}
						sortOrder={mediaSortOrder}
						onSort={handleSort}
						onImport={openFilePicker}
					/>
				}
				className={cn(isDragOver && "bg-accent/30")}
				contentClassName="h-full"
				{...dragProps}
			>
				{isDragOver || filteredMediaItems.length === 0 ? (
					<MediaDragOverlay
						isVisible={true}
						isProcessing={isProcessing}
						progress={progress}
						onClick={openFilePicker}
					/>
				) : (
					<SelectableSurface
						ariaLabel="Assets"
						orderedIds={orderedMediaIds}
						revealId={highlightMediaId}
						onRevealComplete={clearHighlight}
					>
						<MediaScopeRegistrar />
						<MergeVideosPanel
							items={filteredMediaItems}
							orderIds={mergeOrderIds}
							onOrderChange={setMergeOrderIds}
							onMerge={handleMergeVideos}
						/>
						<MediaItemList
							items={filteredMediaItems}
							mode={mediaViewMode}
							onRemove={handleRemove}
						/>
					</SelectableSurface>
				)}
			</PanelView>
		</>
	);
}

function MediaScopeRegistrar() {
	useSelectionScope();
	return null;
}

function MergeVideosPanel({
	items,
	orderIds,
	onOrderChange,
	onMerge,
}: {
	items: MediaAsset[];
	orderIds: string[];
	onOrderChange: (ids: string[]) => void;
	onMerge: ({ assets }: { assets: MediaAsset[] }) => void;
}) {
	const { selectedIds } = useSelection();
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);

	const selectedVideoItems = useMemo(() => {
		const selectedSet = new Set(selectedIds);
		return items.filter(
			(item) => item.type === "video" && selectedSet.has(item.id),
		);
	}, [items, selectedIds]);

	const selectedVideoIds = useMemo(() => {
		return selectedVideoItems.map((item) => item.id);
	}, [selectedVideoItems]);

	useEffect(() => {
		if (selectedVideoIds.length === 0) {
			if (orderIds.length > 0) onOrderChange([]);
			return;
		}

		const selectedSet = new Set(selectedVideoIds);
		const retainedIds = orderIds.filter((id) => selectedSet.has(id));
		const addedIds = selectedVideoIds.filter((id) => !retainedIds.includes(id));
		const nextIds = [...retainedIds, ...addedIds];

		if (nextIds.join("|") !== orderIds.join("|")) {
			onOrderChange(nextIds);
		}
	}, [orderIds, onOrderChange, selectedVideoIds]);

	const selectedVideoById = useMemo(() => {
		return new Map(selectedVideoItems.map((item) => [item.id, item]));
	}, [selectedVideoItems]);

	const orderedItems = useMemo(() => {
		return orderIds
			.map((id) => selectedVideoById.get(id))
			.filter((item): item is MediaAsset => Boolean(item));
	}, [orderIds, selectedVideoById]);

	if (orderedItems.length < 2) return null;

	const handleDragStart = ({ index }: { index: number }) => {
		setDragIndex(index);
	};

	const handleDragOver = ({
		event,
		index,
	}: {
		event: React.DragEvent;
		index: number;
	}) => {
		event.preventDefault();
		if (index !== dropIndex) setDropIndex(index);
	};

	const handleDrop = ({ toIndex }: { toIndex: number }) => {
		if (dragIndex !== null && dragIndex !== toIndex) {
			const nextIds = [...orderIds];
			const [draggedId] = nextIds.splice(dragIndex, 1);
			if (draggedId) {
				nextIds.splice(toIndex, 0, draggedId);
				onOrderChange(nextIds);
			}
		}
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDropIndex(null);
	};

	return (
		<div className="mx-3 mb-3 rounded border bg-background p-2">
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-medium">Merge selected videos</p>
					<p className="text-muted-foreground text-xs">Drag to set order</p>
				</div>
				<Button
					size="sm"
					onClick={() => onMerge({ assets: orderedItems })}
					className="shrink-0"
				>
					Merge
				</Button>
			</div>
			<ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
				{orderedItems.map((item, index) => {
					const isDragging = dragIndex === index;
					const isDropTarget =
						dropIndex === index && dragIndex !== null && dragIndex !== index;

					return (
						<li
							key={item.id}
							draggable
							onDragStart={() => handleDragStart({ index })}
							onDragOver={(event) => handleDragOver({ event, index })}
							onDrop={() => handleDrop({ toIndex: index })}
							onDragEnd={handleDragEnd}
							className={cn(
								"flex cursor-grab items-center gap-2 rounded border bg-muted/20 px-2 py-1.5 active:cursor-grabbing",
								isDragging && "opacity-40",
								isDropTarget && "border-primary",
							)}
						>
							<HugeiconsIcon
								icon={DragDropVerticalIcon}
								className="text-muted-foreground size-4 shrink-0"
							/>
							<span className="truncate text-xs">{item.name}</span>
							<MediaDurationLabel duration={item.duration} />
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function MediaAssetDraggable({
	item,
	preview,
	variant,
	isRounded,
}: {
	item: MediaAsset;
	preview: React.ReactNode;
	variant: "card" | "compact";
	isRounded?: boolean;
}) {
	const editor = useEditor();

	const addElementAtTime = ({
		asset,
		startTime,
	}: {
		asset: MediaAsset;
		startTime: MediaTime;
	}) => {
		const duration =
			asset.duration != null
				? mediaTimeFromSeconds({ seconds: asset.duration })
				: DEFAULT_NEW_ELEMENT_DURATION;
		const element = buildElementFromMedia({
			mediaId: asset.id,
			mediaType: asset.type,
			name: asset.name,
			duration,
			startTime,
		});
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	return (
		<DraggableItem
			name={item.name}
			preview={preview}
			dragData={{
				id: item.id,
				type: "media",
				mediaType: item.type,
				name: item.name,
				...(item.type !== "audio" && {
					targetElementTypes: [...MASKABLE_ELEMENT_TYPES],
				}),
			}}
			shouldShowPlusOnDrag={false}
			onAddToTimeline={({ currentTime }) =>
				addElementAtTime({ asset: item, startTime: currentTime })
			}
			variant={variant}
			isRounded={isRounded}
		/>
	);
}

function MediaItemWithContextMenu({
	item,
	children,
	onRemove,
}: {
	item: MediaAsset;
	children: React.ReactNode;
	onRemove: ({
		event,
		ids,
	}: {
		event: React.MouseEvent;
		ids: string[];
	}) => void;
}) {
	const { isSelected, selectedIds } = useSelection();
	const idsToDelete = isSelected(item.id) ? selectedIds : [item.id];
	const deleteLabel =
		idsToDelete.length > 1 ? `Delete ${idsToDelete.length} items` : "Delete";

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem>Export clips</ContextMenuItem>
				<ContextMenuItem
					variant="destructive"
					onClick={(event: React.MouseEvent<HTMLDivElement>) =>
						onRemove({ event, ids: idsToDelete })
					}
				>
					{deleteLabel}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function MediaItemList({
	items,
	mode,
	onRemove,
}: {
	items: MediaAsset[];
	mode: MediaViewMode;
	onRemove: ({
		event,
		ids,
	}: {
		event: React.MouseEvent;
		ids: string[];
	}) => void;
}) {
	const isGrid = mode === "grid";

	return (
		<div
			className={cn(isGrid ? "grid gap-4" : "flex flex-col gap-1.5")}
			style={
				isGrid ? { gridTemplateColumns: "repeat(auto-fill, 7rem)" } : undefined
			}
		>
			{items.map((item) => (
				<MediaItemWithContextMenu item={item} onRemove={onRemove} key={item.id}>
					<SelectableItem className={cn(!isGrid && "w-full")} id={item.id}>
						<MediaAssetDraggable
							item={item}
							preview={
								<MediaPreview
									item={item}
									variant={isGrid ? "grid" : "compact"}
								/>
							}
							variant={isGrid ? "card" : "compact"}
							isRounded={isGrid ? false : undefined}
						/>
					</SelectableItem>
				</MediaItemWithContextMenu>
			))}
		</div>
	);
}

function formatDuration({ duration }: { duration: number }) {
	const min = Math.floor(duration / 60);
	const sec = Math.floor(duration % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function MediaDurationBadge({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">
			{formatDuration({ duration })}
		</div>
	);
}

function MediaDurationLabel({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<span className="text-xs opacity-70">{formatDuration({ duration })}</span>
	);
}

function MediaTypePlaceholder({
	icon,
	label,
	duration,
	variant,
}: {
	icon: IconSvgElement;
	label: string;
	duration?: number;
	variant: "muted" | "bordered";
}) {
	const iconClassName = cn("size-6", variant === "bordered" && "mb-1");

	return (
		<div
			className={cn(
				"text-muted-foreground flex size-full flex-col items-center justify-center rounded",
				variant === "muted" ? "bg-muted/30" : "border",
			)}
		>
			<HugeiconsIcon icon={icon} className={iconClassName} />
			<span className="text-xs">{label}</span>
			<MediaDurationLabel duration={duration} />
		</div>
	);
}

function MediaPreview({
	item,
	variant = "grid",
}: {
	item: MediaAsset;
	variant?: "grid" | "compact";
}) {
	const shouldShowDurationBadge = variant === "grid";

	if (item.type === "image") {
		return (
			<div className="relative flex size-full items-center justify-center bg-muted">
				<Image
					src={item.url ?? ""}
					alt={item.name}
					fill
					sizes="100vw"
					className="object-cover"
					loading="lazy"
					unoptimized
				/>
			</div>
		);
	}

	if (item.type === "video") {
		if (item.thumbnailUrl) {
			return (
				<div className="relative size-full">
					<Image
						src={item.thumbnailUrl}
						alt={item.name}
						fill
						sizes="100vw"
						className="rounded object-cover"
						loading="lazy"
						unoptimized
					/>
					{shouldShowDurationBadge ? (
						<MediaDurationBadge duration={item.duration} />
					) : null}
				</div>
			);
		}

		return (
			<MediaTypePlaceholder
				icon={Video01Icon}
				label="Video"
				duration={item.duration}
				variant="muted"
			/>
		);
	}

	if (item.type === "audio") {
		return (
			<MediaTypePlaceholder
				icon={MusicNote03Icon}
				label="Audio"
				duration={item.duration}
				variant="bordered"
			/>
		);
	}

	return (
		<MediaTypePlaceholder icon={Image02Icon} label="Unknown" variant="muted" />
	);
}

function MediaActions({
	mediaViewMode,
	setMediaViewMode,
	isProcessing,
	sortBy,
	sortOrder,
	onSort,
	onImport,
}: {
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	isProcessing: boolean;
	sortBy: MediaSortKey;
	sortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
	onImport: () => void;
}) {
	return (
		<div className="flex gap-1.5">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size="icon"
							variant="ghost"
							onClick={() =>
								setMediaViewMode(mediaViewMode === "grid" ? "list" : "grid")
							}
							disabled={isProcessing}
							className="items-center justify-center"
						>
							{mediaViewMode === "grid" ? (
								<HugeiconsIcon icon={LeftToRightListDashIcon} />
							) : (
								<HugeiconsIcon icon={GridViewIcon} />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>
							{mediaViewMode === "grid"
								? "Switch to list view"
								: "Switch to grid view"}
						</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<DropdownMenu>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									disabled={isProcessing}
									className="items-center justify-center"
								>
									<HugeiconsIcon icon={SortingOneNineIcon} />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<DropdownMenuContent align="end">
							<SortMenuItem
								label="Name"
								sortKey="name"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Type"
								sortKey="type"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Duration"
								sortKey="duration"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="File size"
								sortKey="size"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
					<TooltipContent>
						<p>
							Sort by {sortBy} (
							{sortOrder === "asc" ? "ascending" : "descending"})
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<Button
				variant="outline"
				onClick={onImport}
				disabled={isProcessing}
				size="sm"
				className="items-center justify-center gap-1.5"
			>
				<HugeiconsIcon icon={CloudUploadIcon} />
				Import
			</Button>
		</div>
	);
}

function SortMenuItem({
	label,
	sortKey,
	currentSortBy,
	currentSortOrder,
	onSort,
}: {
	label: string;
	sortKey: MediaSortKey;
	currentSortBy: MediaSortKey;
	currentSortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
}) {
	const isActive = currentSortBy === sortKey;
	const arrow = isActive ? (currentSortOrder === "asc" ? "↑" : "↓") : "";

	return (
		<DropdownMenuItem onClick={() => onSort({ key: sortKey })}>
			{label} {arrow}
		</DropdownMenuItem>
	);
}
