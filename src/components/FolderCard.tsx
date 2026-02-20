import { Folder, Lock, Trash2, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LockBadge } from '@/components/LockIcon';
import { cn } from '@/lib/utils';

interface FolderCardProps {
  name: string | null; // null if locked
  locked: boolean;
  fileCount?: number;
  onClick: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  className?: string;
}

export function FolderCard({
  name,
  locked,
  fileCount,
  onClick,
  onDelete,
  onDownload,
  className,
}: FolderCardProps) {
  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden transition-all duration-200',
        'border-border/50 bg-card/50 backdrop-blur-sm',
        'hover:border-primary/30 hover:shadow-md',
        locked && 'hover:border-warning/30',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                'flex-shrink-0 rounded-lg p-2.5 transition-colors',
                locked 
                  ? 'bg-warning/10 text-warning' 
                  : 'bg-primary/10 text-primary group-hover:bg-primary/20'
              )}
            >
              {locked ? (
                <Lock className="h-5 w-5" />
              ) : (
                <Folder className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {locked ? (
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">Locked Folder</p>
                  <p className="text-xs text-muted-foreground/60">Click to unlock</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-foreground truncate">{name}</p>
                  {fileCount !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {fileCount} {fileCount === 1 ? 'file' : 'files'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <LockBadge locked={locked} />
          </div>
        </div>
        
        {/* Action buttons - only show when unlocked */}
        {!locked && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download ZIP
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CreateFolderCardProps {
  onClick: () => void;
  className?: string;
}

export function CreateFolderCard({ onClick, className }: CreateFolderCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer overflow-hidden transition-all duration-200',
        'border-dashed border-2 border-border/50 bg-transparent',
        'hover:border-primary/50 hover:bg-primary/5',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="rounded-lg p-3 bg-muted/50 mb-3">
            <Folder className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">Create Folder</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Password-protected
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
