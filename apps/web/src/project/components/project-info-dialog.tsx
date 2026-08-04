import { useEffect, useState } from "react";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { TProjectMetadata } from "@/project/types";
import { formatDate } from "@/utils/date";
import { formatTimecode, mediaTimeToSeconds } from "opencut-wasm";
import { Button } from "@/components/ui/button";
import { storageService } from "@/services/storage/service";
import { formatStorageBytes } from "@/services/storage/quota";

function InfoRow({
	label,
	value,
}: {
	label: string;
	value: string | React.ReactNode;
}) {
	return (
		<div className="flex justify-between items-center py-1 border-b border-border/40 last:border-none">
			<span className="text-muted-foreground text-sm">{label}</span>
			<span className="text-sm font-medium">{value}</span>
		</div>
	);
}

export function ProjectInfoDialog({
	isOpen,
	onOpenChange,
	project,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	project: TProjectMetadata;
}) {
	const [storageInfo, setStorageInfo] = useState<{
		totalBytes: number;
		mediaItems: number;
	} | null>(null);

	useEffect(() => {
		if (isOpen && project.id) {
			let isMounted = true;
			storageService
				.getProjectStorageInfo({ projectId: project.id })
				.then((info) => {
					if (isMounted) {
						setStorageInfo(info);
					}
				})
				.catch(() => {});
			return () => {
				isMounted = false;
			};
		}
	}, [isOpen, project.id]);

	const durationSeconds = mediaTimeToSeconds({ time: project.duration });
	const durationFormatted =
		project.duration > 0
			? formatTimecode({
					time: project.duration,
					format: durationSeconds >= 3600 ? "HH:MM:SS" : "MM:SS",
				}) ?? ""
			: "0:00";

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
				<DialogHeader>
					<DialogTitle className="truncate max-w-[350px]">
						{project.name}
					</DialogTitle>
				</DialogHeader>

				<DialogBody className="flex flex-col gap-1">
					<InfoRow label="Duration" value={durationFormatted} />
					<InfoRow
						label="Storage Used"
						value={
							storageInfo
								? `${formatStorageBytes({ bytes: storageInfo.totalBytes })} (${storageInfo.mediaItems} files)`
								: "Calculating..."
						}
					/>
					<InfoRow
						label="Created"
						value={formatDate({ date: project.createdAt })}
					/>
					<InfoRow
						label="Modified"
						value={formatDate({ date: project.updatedAt })}
					/>
					<InfoRow
						label="Project ID"
						value={
							<code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
								{project.id.slice(0, 8)}
							</code>
						}
					/>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button onClick={() => onOpenChange(false)}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
