/**
 * React hooks for workspace state management
 */

import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import type { EncryptedWorkspace, EncryptedFolder } from './storage';

// Session state (in-memory only, never persisted)
interface WorkspaceSession {
  // Current workspace
  workspace: EncryptedWorkspace | null;
  workspaceKey: CryptoKey | null;
  workspaceName: string | null;
  
  // Unlocked folders (folder ID -> key and name)
  unlockedFolders: Map<string, { key: CryptoKey; name: string }>;
  
  // Current view
  currentFolderId: string | null;
}

type SessionAction =
  | { type: 'UNLOCK_WORKSPACE'; payload: { workspace: EncryptedWorkspace; key: CryptoKey; name: string } }
  | { type: 'LOCK_WORKSPACE' }
  | { type: 'UNLOCK_FOLDER'; payload: { folderId: string; key: CryptoKey; name: string } }
  | { type: 'LOCK_FOLDER'; payload: { folderId: string } }
  | { type: 'SET_CURRENT_FOLDER'; payload: string | null };

const initialState: WorkspaceSession = {
  workspace: null,
  workspaceKey: null,
  workspaceName: null,
  unlockedFolders: new Map(),
  currentFolderId: null,
};

function sessionReducer(state: WorkspaceSession, action: SessionAction): WorkspaceSession {
  switch (action.type) {
    case 'UNLOCK_WORKSPACE':
      return {
        ...state,
        workspace: action.payload.workspace,
        workspaceKey: action.payload.key,
        workspaceName: action.payload.name,
      };
    
    case 'LOCK_WORKSPACE':
      return initialState;
    
    case 'UNLOCK_FOLDER': {
      const newFolders = new Map(state.unlockedFolders);
      newFolders.set(action.payload.folderId, {
        key: action.payload.key,
        name: action.payload.name,
      });
      return {
        ...state,
        unlockedFolders: newFolders,
        currentFolderId: action.payload.folderId,
      };
    }
    
    case 'LOCK_FOLDER': {
      const newFolders = new Map(state.unlockedFolders);
      newFolders.delete(action.payload.folderId);
      return {
        ...state,
        unlockedFolders: newFolders,
        currentFolderId: state.currentFolderId === action.payload.folderId ? null : state.currentFolderId,
      };
    }
    
    case 'SET_CURRENT_FOLDER':
      return {
        ...state,
        currentFolderId: action.payload,
      };
    
    default:
      return state;
  }
}

interface WorkspaceContextValue {
  session: WorkspaceSession;
  dispatch: React.Dispatch<SessionAction>;
  isWorkspaceUnlocked: boolean;
  isFolderUnlocked: (folderId: string) => boolean;
  getFolderKey: (folderId: string) => CryptoKey | null;
  getFolderName: (folderId: string) => string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(sessionReducer, initialState);
  
  const isWorkspaceUnlocked = session.workspace !== null;
  
  const isFolderUnlocked = useCallback((folderId: string) => {
    return session.unlockedFolders.has(folderId);
  }, [session.unlockedFolders]);
  
  const getFolderKey = useCallback((folderId: string) => {
    return session.unlockedFolders.get(folderId)?.key ?? null;
  }, [session.unlockedFolders]);
  
  const getFolderName = useCallback((folderId: string) => {
    return session.unlockedFolders.get(folderId)?.name ?? null;
  }, [session.unlockedFolders]);
  
  return (
    <WorkspaceContext.Provider
      value={{
        session,
        dispatch,
        isWorkspaceUnlocked,
        isFolderUnlocked,
        getFolderKey,
        getFolderName,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
