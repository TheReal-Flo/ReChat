"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { X, File, Image, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";
import { toast } from "sonner";

interface FileUploadProps {
  onFilesUploaded: (files: { name: string; type: string; url: string }[]) => void;
  maxFiles?: number;
  className?: string;
}

interface UploadedFile {
  name: string;
  type: string;
  url: string;
  size: number;
}

export function FileUpload({ onFilesUploaded, maxFiles = 4, className }: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadComplete = useCallback((res: any[]) => {
    if (res) {
      const newFiles = res.map(file => ({
        name: file.name,
        type: file.type || 'unknown',
        url: file.url,
        size: file.size
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
      onFilesUploaded(newFiles);
      toast.success(`${newFiles.length} file(s) uploaded successfully!`);
    }
    setIsUploading(false);
  }, [onFilesUploaded]);

  const handleUploadError = useCallback((error: Error) => {
    toast.error(`Upload failed: ${error.message}`);
    setIsUploading(false);
  }, []);

  const { startUpload: startImageUpload } = useUploadThing("imageUploader", {
    onClientUploadComplete: handleUploadComplete,
    onUploadError: handleUploadError,
  });

  const { startUpload: startPdfUpload } = useUploadThing("pdfUploader", {
    onClientUploadComplete: handleUploadComplete,
    onUploadError: handleUploadError,
  });

  const isImageFile = useCallback((file: File) => file.type.startsWith('image/'), []);
  
  const isPdfFile = useCallback((file: File) => {
    return file.type === 'application/pdf';
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    if (acceptedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    
    // Separate files by type
    const imageFiles = acceptedFiles.filter(isImageFile);
    const pdfFiles = acceptedFiles.filter(isPdfFile);
    const unsupportedFiles = acceptedFiles.filter(file => 
      !isImageFile(file) && !isPdfFile(file)
    );

    // Show warning for unsupported files
    if (unsupportedFiles.length > 0) {
      toast.error(`${unsupportedFiles.length} file(s) not supported. Supported: images and PDF only`);
    }

    try {
      // Upload images if any
      if (imageFiles.length > 0) {
        startImageUpload(imageFiles);
      }
      
      // Upload PDFs if any
      if (pdfFiles.length > 0) {
        startPdfUpload(pdfFiles);
      }

      // If no supported files, reset loading state
      if (imageFiles.length === 0 && pdfFiles.length === 0) {
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
      setIsUploading(false);
    }
  }, [uploadedFiles.length, maxFiles, startImageUpload, startPdfUpload, isImageFile, isPdfFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'],
      'application/pdf': ['.pdf']
    },
    maxFiles,
    disabled: isUploading,
    multiple: true
  });

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = useCallback((type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-teal-400 bg-teal-400/10" : "hover:border-gray-500",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        {isDragActive ? (
          <p className="text-teal-400">Drop the files here...</p>
        ) : (
          <div className="text-gray-400">
            <p>Drag & drop files here, or click to select</p>
            <p className="text-sm mt-1">Supports: Images and PDF only (max {maxFiles} files)</p>
          </div>
        )}
        {isUploading && (
          <div className="mt-2">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-400 mt-1">Uploading...</p>
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Uploaded Files</h4>
          {uploadedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                {getFileIcon(file.type)}
                <div>
                  <p className="text-sm text-gray-300 truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}