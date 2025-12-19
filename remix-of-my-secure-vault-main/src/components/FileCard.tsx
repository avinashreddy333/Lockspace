import { 
  File, FileText, FileImage, FileVideo, FileAudio, 
  FileCode, FileArchive, Download, Trash2, Eye 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Map MIME types to icons
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.startsWith('text/')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return FileArchive;
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml')) return FileCode;
  return File;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface FileCardProps {
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
  onDownload: () => void;
  onDelete: () => void;
  onPreview?: () => void;
  className?: string;
}

export function FileCard({
  name,
  size,
  mimeType,
  createdAt,
  onDownload,
  onDelete,
  onPreview,
  className,
}: FileCardProps) {
  const Icon = getFileIcon(mimeType);
  const canPreview = mimeType.startsWith('image/') || mimeType.startsWith('text/');
  
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        'border-border/50 bg-card/50 backdrop-blur-sm',
        'hover:border-primary/30 hover:shadow-md',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-lg p-2.5 bg-secondary/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate text-sm" title={name}>
              {name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatFileSize(size)}
              </span>
              <span className="text-xs text-muted-foreground/50">•</span>
              <span className="text-xs text-muted-foreground truncate">
                {new Date(createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
          {canPreview && onPreview && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs text-muted-foreground hover:text-primary"
              onClick={onPreview}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 text-xs text-muted-foreground hover:text-primary',
              !canPreview && 'flex-1'
            )}
            onClick={onDownload}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface UploadAreaProps {
  onFiles: (files: FileList) => void;
  className?: string;
  disabled?: boolean;
}

export function UploadArea({ onFiles, className, disabled }: UploadAreaProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleClick = () => {
    if (disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        onFiles(files);
      }
    };
    input.click();
  };
  
  return (
    <div
      className={cn(
        'rounded-lg border-2 border-dashed border-border/50 p-8 text-center transition-all duration-200',
        'hover:border-primary/50 hover:bg-primary/5',
        'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed hover:border-border/50 hover:bg-transparent',
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
    >
      <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <File className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">
        Drop files here or click to upload
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Files will be encrypted with AES-256-GCM
      </p>
    </div>
  );
}
