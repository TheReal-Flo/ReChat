"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUpload } from "./FileUpload";
import { Paperclip } from "lucide-react";

interface FileUploadDialogProps {
  onFilesSelected: (files: { name: string; type: string; url: string }[]) => void;
  disabled?: boolean;
}

export function FileUploadDialog({ onFilesSelected, disabled }: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; url: string }[]>([]);

  const handleFilesUploaded = (files: { name: string; type: string; url: string }[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleConfirm = () => {
    onFilesSelected(selectedFiles);
    setSelectedFiles([]);
    setOpen(false);
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-1 border border-gray-600 rounded-lg px-3 py-1 cursor-pointer hover:bg-gray-700/50 transition-colors">
          <Paperclip className="w-3 h-3" />
          <span>Attach</span>
        </div>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-600 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Upload Files</DialogTitle>
          <DialogDescription className="text-gray-400">
            Upload images, documents, or other files to include in your message.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <FileUpload 
            onFilesUploaded={handleFilesUploaded}
            maxFiles={4}
          />
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleCancel}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={selectedFiles.length === 0}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Add Files ({selectedFiles.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}