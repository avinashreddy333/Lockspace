import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FolderCard, CreateFolderCard } from '@/components/FolderCard';
import { FileCard, UploadArea } from '@/components/FileCard';
import { PasswordDialog } from '@/components/PasswordDialog';
import { ZeroKnowledgeBadge } from '@/components/SecurityWarning';
import { useWorkspace } from '@/lib/workspace-context';
import { useToast } from '@/hooks/use-toast';
import {
  getWorkspaceFolders,
  createFolder,
  unlockFolder,
  deleteFolder,
  getFolderFiles,
  uploadFile,
  downloadFile,
  deleteFile,
  decryptFileMetadata,
  type EncryptedFolder,
} from '@/lib/storage';
import JSZip from 'jszip';

interface DecryptedFileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
}

export function WorkspaceView() {
  const { session, dispatch, isFolderUnlocked, getFolderKey, getFolderName } = useWorkspace();
  const { toast } = useToast();
  
  // Folder state
  const [folders, setFolders] = useState<EncryptedFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // File state
  const [files, setFiles] = useState<DecryptedFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  // Dialog state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [unlockFolderOpen, setUnlockFolderOpen] = useState(false);
  const [folderToUnlock, setFolderToUnlock] = useState<string | null>(null);
  
  // Load folders
  const loadFolders = useCallback(async () => {
    if (session.workspace) {
      const workspaceFolders = await getWorkspaceFolders(session.workspace.id);
      setFolders(workspaceFolders);
    }
  }, [session.workspace]);
  
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);
  
  // Load files for selected folder
  useEffect(() => {
    const loadFiles = async () => {
      if (!selectedFolderId) {
        setFiles([]);
        return;
      }
      
      const folderKey = getFolderKey(selectedFolderId);
      if (!folderKey) {
        setFiles([]);
        return;
      }
      
      setLoadingFiles(true);
      
      try {
        const encryptedFiles = await getFolderFiles(selectedFolderId);
        const decryptedFiles: DecryptedFileInfo[] = [];
        
        for (const file of encryptedFiles) {
          try {
            const name = await decryptFileMetadata(file, folderKey);
            decryptedFiles.push({
              id: file.id,
              name,
              size: file.size,
              mimeType: file.mimeType,
              createdAt: file.createdAt,
            });
          } catch {
            // Skip files that can't be decrypted
          }
        }
        
        setFiles(decryptedFiles.sort((a, b) => b.createdAt - a.createdAt));
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error loading files',
          description: 'Could not decrypt file list.',
        });
      } finally {
        setLoadingFiles(false);
      }
    };
    
    loadFiles();
  }, [selectedFolderId, getFolderKey, toast]);
  
  // Handle folder creation
  const handleCreateFolder = async (password: string, folderName?: string) => {
    if (!session.workspace || !folderName?.trim()) return false;
    
    try {
      const { folder, key } = await createFolder(
        session.workspace.id,
        password,
        folderName.trim()
      );
      
      dispatch({
        type: 'UNLOCK_FOLDER',
        payload: { folderId: folder.id, key, name: folderName.trim() },
      });
      
      loadFolders();
      setSelectedFolderId(folder.id);
      
      toast({
        title: 'Folder created',
        description: `"${folderName.trim()}" is ready for files.`,
      });
      
      return true;
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create folder.',
      });
      return false;
    }
  };
  
  // Handle folder unlock
  const handleUnlockFolder = async (password: string) => {
    if (!folderToUnlock) return false;
    
    const result = await unlockFolder(folderToUnlock, password);
    
    if (!result) {
      return false;
    }
    
    dispatch({
      type: 'UNLOCK_FOLDER',
      payload: { folderId: folderToUnlock, key: result.key, name: result.name },
    });
    
    setSelectedFolderId(folderToUnlock);
    setFolderToUnlock(null);
    
    return true;
  };
  
  // Handle folder click
  const handleFolderClick = (folder: EncryptedFolder) => {
    if (isFolderUnlocked(folder.id)) {
      setSelectedFolderId(folder.id);
    } else {
      setFolderToUnlock(folder.id);
      setUnlockFolderOpen(true);
    }
  };
  
  // Handle folder delete
  const handleDeleteFolder = async (folderId: string) => {
    const name = getFolderName(folderId) || 'this folder';
    
    if (confirm(`Delete "${name}" and all its files? This cannot be undone.`)) {
      await deleteFolder(folderId);
      
      dispatch({
        type: 'LOCK_FOLDER',
        payload: { folderId },
      });
      
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      
      loadFolders();
      
      toast({
        title: 'Folder deleted',
        description: `"${name}" has been permanently deleted.`,
      });
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (fileList: FileList) => {
    if (!selectedFolderId) return;
    
    const folderKey = getFolderKey(selectedFolderId);
    if (!folderKey) return;
    
    const uploadedFiles: string[] = [];
    
    for (const file of Array.from(fileList)) {
      try {
        const encryptedFile = await uploadFile(selectedFolderId, folderKey, file);
        uploadedFiles.push(file.name);
        
        // Add to local state
        setFiles(prev => [{
          id: encryptedFile.id,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          createdAt: encryptedFile.createdAt,
        }, ...prev]);
      } catch (err) {
  console.error("Encryption error:", err);

  toast({
    variant: 'destructive',
    title: 'Upload failed',
    description: `Could not encrypt "${file.name}". Check console.`,
  });
}
    }    
    if (uploadedFiles.length > 0) {
      toast({
        title: 'Files uploaded',
        description: `${uploadedFiles.length} file(s) encrypted and stored.`,
      });
    }
  };
  
  // Handle file download
  const handleFileDownload = async (fileId: string) => {
    if (!selectedFolderId) return;
    
    const folderKey = getFolderKey(selectedFolderId);
    if (!folderKey) return;
    
    try {
      const result = await downloadFile(fileId, folderKey);
      
      if (!result) {
        toast({
          variant: 'destructive',
          title: 'Download failed',
          description: 'Could not decrypt file.',
        });
        return;
      }
      
      // Create download link
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'File downloaded',
        description: `"${result.filename}" decrypted and saved.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'An error occurred during decryption.',
      });
    }
  };
  
  // Handle file delete
  const handleFileDelete = async (fileId: string, fileName: string) => {
    if (confirm(`Delete "${fileName}"? This cannot be undone.`)) {
      await deleteFile(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      
      toast({
        title: 'File deleted',
        description: `"${fileName}" has been permanently deleted.`,
      });
    }
  };
  
  // Handle folder ZIP download
  const handleFolderDownload = async (folderId: string) => {
    const folderKey = getFolderKey(folderId);
    const folderName = getFolderName(folderId);
    
    if (!folderKey || !folderName) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Folder must be unlocked first.',
      });
      return;
    }
    
    const folderFiles = await getFolderFiles(folderId);
    
    if (folderFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Empty folder',
        description: 'This folder has no files to download.',
      });
      return;
    }
    
    toast({
      title: 'Preparing download',
      description: 'Decrypting files and creating ZIP...',
    });
    
    try {
      const zip = new JSZip();
      
      for (const file of folderFiles) {
        const result = await downloadFile(file.id, folderKey);
        if (result) {
          zip.file(result.filename, result.data);
        }
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Download complete',
        description: `"${folderName}.zip" is ready.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Could not create ZIP file.',
      });
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    dispatch({ type: 'LOCK_WORKSPACE' });
  };
  
  const currentFolderName = selectedFolderId ? getFolderName(selectedFolderId) : null;
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedFolderId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFolderId(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {selectedFolderId ? currentFolderName : session.workspaceName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedFolderId 
                    ? `${files.length} encrypted file(s)` 
                    : `${folders.length} folder(s)`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ZeroKnowledgeBadge className="hidden sm:flex" />
              <Button
                variant="ghost"
                size="icon"
                onClick={loadFolders}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Lock</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {selectedFolderId ? (
          // File view
          <div className="space-y-6 animate-fade-in">
            <UploadArea onFiles={handleFileUpload} />
            
            {loadingFiles ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Decrypting file list...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No files yet. Upload some files above.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    name={file.name}
                    size={file.size}
                    mimeType={file.mimeType}
                    createdAt={file.createdAt}
                    onDownload={() => handleFileDownload(file.id)}
                    onDelete={() => handleFileDelete(file.id, file.name)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // Folder view
          <div className="space-y-6 animate-fade-in">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CreateFolderCard onClick={() => setCreateFolderOpen(true)} />
              
              {folders.map((folder) => {
                const isUnlocked = isFolderUnlocked(folder.id);
                const name = isUnlocked ? getFolderName(folder.id) : null;
                
                return (
                  <FolderCard
                    key={folder.id}
                    name={name}
                    locked={!isUnlocked}
                    onClick={() => handleFolderClick(folder)}
                    onDelete={isUnlocked ? () => handleDeleteFolder(folder.id) : undefined}
                    onDownload={isUnlocked ? () => handleFolderDownload(folder.id) : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}
      </main>
      
      {/* Create folder dialog */}
      <PasswordDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        mode="create"
        title="Create Folder"
        description="Enter a name and password for your new encrypted folder."
        onSubmit={handleCreateFolder}
        showStrength
        requireStrong
        showNameInput
        namePlaceholder="Folder name"
      />
      
      {/* Unlock folder dialog */}
      <PasswordDialog
        open={unlockFolderOpen}
        onOpenChange={setUnlockFolderOpen}
        mode="unlock"
        title="Unlock Folder"
        description="Enter the password to access this folder."
        onSubmit={handleUnlockFolder}
      />
    </div>
  );
}
