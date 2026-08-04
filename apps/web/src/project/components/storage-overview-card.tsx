"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HardDrive, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useEditor } from "@/editor/use-editor";
import {
	readStorageQuotaStatus,
	formatStorageBytes,
	type StorageQuotaStatus,
} from "@/services/storage/quota";
import { storageService } from "@/services/storage/service";

declare global {
	interface Window {
		electronAPI?: {
			selectDataDirectory: () => Promise<string | null>;
			getDataDirectory: () => Promise<string>;
			setExportProgress: (progress: number) => void;
		};
	}
}

export function StorageOverviewCard() {
	const editor = useEditor();
	const savedProjects = useEditor((e) => e.project.getSavedProjects());
	const [quotaStatus, setQuotaStatus] = useState<StorageQuotaStatus | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [dataDirectory, setDataDirectory] = useState<string | null>(null);

	const refreshStorage = async () => {
		const status = await readStorageQuotaStatus();
		setQuotaStatus(status);

		if (typeof window !== "undefined" && window.electronAPI?.getDataDirectory) {
			try {
				const dir = await window.electronAPI.getDataDirectory();
				setDataDirectory(dir);
			} catch (e) {
				console.warn("Failed to get data directory:", e);
			}
		}
	};

	useEffect(() => {
		refreshStorage();
	}, [savedProjects]);

	const handleSelectDriveFolder = async () => {
		if (typeof window === "undefined" || !window.electronAPI?.selectDataDirectory) {
			toast.info("Vui lòng sử dụng ứng dụng OpenCut PC Desktop để đổi ổ đĩa lưu trữ.");
			return;
		}

		try {
			const selectedPath = await window.electronAPI.selectDataDirectory();
			if (selectedPath) {
				setDataDirectory(selectedPath);
				toast.success(
					`Đã đổi vị trí lưu trữ sang: "${selectedPath}". Hãy khởi động lại app để hoàn tất!`,
					{ duration: 6000 },
				);
			}
		} catch (error) {
			console.error("Failed to select folder:", error);
			toast.error("Không thể chọn thư mục lưu trữ");
		}
	};

	const handleClearAll = async () => {
		setIsDeleting(true);
		try {
			const projectIds = savedProjects.map((p) => p.id);
			if (projectIds.length > 0) {
				await editor.project.deleteProjects({ ids: projectIds });
			}
			await storageService.clearAllData();
			await storageService.clearSavedSounds();
			toast.success("Đã dọn dẹp thành công tất cả dự án & dữ liệu cũ!");
			await editor.project.loadAllProjects();
			await refreshStorage();
		} catch (error) {
			console.error("Dọn dẹp dữ liệu thất bại:", error);
			toast.error("Dọn dẹp dữ liệu thất bại");
		} finally {
			setIsDeleting(false);
			setIsConfirmOpen(false);
		}
	};

	const usedText =
		quotaStatus?.usageBytes !== null && quotaStatus?.usageBytes !== undefined
			? formatStorageBytes({ bytes: quotaStatus.usageBytes })
			: "0 B";

	const quotaText =
		quotaStatus?.quotaBytes !== null && quotaStatus?.quotaBytes !== undefined
			? formatStorageBytes({ bytes: quotaStatus.quotaBytes })
			: null;

	const usagePercent =
		quotaStatus?.quotaBytes && quotaStatus?.usageBytes
			? Math.min(
					Math.round((quotaStatus.usageBytes / quotaStatus.quotaBytes) * 100),
					100,
				)
			: 0;

	return (
		<div className="mx-8 my-3 p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
			<div className="flex flex-col gap-2 flex-1 w-full max-w-2xl">
				<div className="flex items-center justify-between text-sm">
					<div className="flex items-center gap-2 font-medium">
						<HardDrive className="size-4 text-primary shrink-0" />
						<span>Lưu lượng Data & Dự án</span>
						{dataDirectory && (
							<span className="hidden lg:inline-block text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded truncate max-w-[280px]" title={dataDirectory}>
								📂 {dataDirectory}
							</span>
						)}
					</div>
					<span className="text-muted-foreground text-xs font-mono">
						{usedText} {quotaText ? `/ ${quotaText}` : ""} ({savedProjects.length} dự án)
					</span>
				</div>
				<Progress value={Math.max(usagePercent, 1)} className="h-2 w-full" />
			</div>

			<div className="flex items-center gap-2 shrink-0 self-end md:self-center">
				<Button
					variant="outline"
					size="sm"
					onClick={handleSelectDriveFolder}
					className="gap-1.5"
					title="Đổi ổ đĩa/thư mục lưu dữ liệu"
				>
					<FolderOpen className="size-4 text-primary" />
					<span>Đổi ổ đĩa lưu</span>
				</Button>

				<Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
					<DialogTrigger asChild>
						<Button variant="destructive" size="sm" className="gap-1.5">
							<Trash2 className="size-4" />
							<span>Dọn dẹp tất cả</span>
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Xác nhận dọn dẹp tất cả dữ liệu?</DialogTitle>
							<DialogDescription>
								Thao tác này sẽ xóa vĩnh viễn toàn bộ {savedProjects.length} dự án, các file media/âm thanh đã lưu và làm sạch bộ nhớ đệm trên máy. Thao tác này không thể hoàn tác.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2 sm:gap-0">
							<Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
								Hủy bỏ
							</Button>
							<Button
								variant="destructive"
								onClick={handleClearAll}
								disabled={isDeleting}
								className="gap-2"
							>
								{isDeleting ? "Đang dọn dẹp..." : "Đồng ý dọn dẹp sạch"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
