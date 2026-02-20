import { useState } from 'react';
import { ShieldCheck, KeyRound, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ZeroKnowledgeBadge, PasswordWarningBanner } from '@/components/SecurityWarning';
import { PasswordInput, PasswordStrength, UnlockButton } from '@/components/PasswordInput';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/lib/workspace-context';
import { createWorkspace, unlockWorkspace, workspaceExists } from '@/lib/storage';
import { validatePasswordStrength, artificialDelay } from '@/lib/crypto';

export function WelcomeScreen() {
  const [mode, setMode] = useState<'welcome' | 'create' | 'unlock'>('welcome');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { toast } = useToast();
  const { dispatch } = useWorkspace();
  
  const handleCreate = async () => {
    if (!workspaceName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Please enter a name for your workspace.',
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical.',
      });
      return;
    }
    
    const { valid, errors } = validatePasswordStrength(password);
    if (!valid) {
      toast({
        variant: 'destructive',
        title: 'Password too weak',
        description: errors[0],
      });
      return;
    }
    
    // Check if workspace already exists
    const exists = await workspaceExists(password);
    if (exists) {
      toast({
        variant: 'destructive',
        title: 'Workspace exists',
        description: 'A workspace with this password already exists. Try unlocking instead.',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const { workspace, key } = await createWorkspace(password, workspaceName);
      
      dispatch({
        type: 'UNLOCK_WORKSPACE',
        payload: { workspace, key, name: workspaceName },
      });
      
      toast({
        title: 'Workspace created',
        description: 'Your encrypted workspace is ready.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create workspace.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUnlock = async () => {
    setLoading(true);
    
    try {
      // Add artificial delay for brute-force protection
      if (failedAttempts > 0) {
        const delay = Math.min(failedAttempts * 1000, 5000);
        await artificialDelay(delay);
      }
      
      const result = await unlockWorkspace(password);
      
      if (!result) {
        setFailedAttempts(prev => prev + 1);
        toast({
          variant: 'destructive',
          title: 'Incorrect password',
          description: 'No workspace found with this password.',
        });
        return;
      }
      
      dispatch({
        type: 'UNLOCK_WORKSPACE',
        payload: result,
      });
      
      toast({
        title: 'Workspace unlocked',
        description: `Welcome back to "${result.name}"`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to unlock workspace.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (mode === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Zero-Knowledge Vault
            </h1>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your files, encrypted. Your password, never stored. 
              True end-to-end encryption.
            </p>
            <div className="mt-4">
              <ZeroKnowledgeBadge />
            </div>
          </div>
          
          <div className="grid gap-4">
            <Card 
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => setMode('create')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 rounded-lg p-3 bg-primary/10">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Create New Workspace</h3>
                    <p className="text-sm text-muted-foreground">
                      Start fresh with a new encrypted vault
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => setMode('unlock')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 rounded-lg p-3 bg-secondary">
                    <KeyRound className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Unlock Existing</h3>
                    <p className="text-sm text-muted-foreground">
                      Access your workspace with your password
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              AES-256-GCM encryption • PBKDF2 key derivation • Client-side only
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (mode === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader>
            <CardTitle>Create Workspace</CardTitle>
            <CardDescription>
              Choose a strong password. It's the only way to access your data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordWarningBanner />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Workspace Name
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="My Secure Vault"
                className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Create a strong password"
                disabled={loading}
              />
            </div>
            
            <PasswordStrength password={password} />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm your password"
                disabled={loading}
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMode('welcome');
                  setPassword('');
                  setConfirmPassword('');
                  setWorkspaceName('');
                }}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <UnlockButton
                onClick={handleCreate}
                loading={loading}
                disabled={!password || !confirmPassword || !workspaceName}
                className="flex-1"
              >
                Create Workspace
              </UnlockButton>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle>Unlock Workspace</CardTitle>
          <CardDescription>
            Enter your password to access your encrypted vault.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Password
            </label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              autoFocus
              disabled={loading}
            />
          </div>
          
          {failedAttempts >= 3 && (
            <p className="text-sm text-warning">
              Multiple failed attempts. A {Math.min(failedAttempts, 5)}-second delay 
              will be applied.
            </p>
          )}
          
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setMode('welcome');
                setPassword('');
                setFailedAttempts(0);
              }}
              disabled={loading}
              className="flex-1"
            >
              Back
            </Button>
            <UnlockButton
              onClick={handleUnlock}
              loading={loading}
              disabled={!password}
              className="flex-1"
            >
              Unlock
            </UnlockButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
