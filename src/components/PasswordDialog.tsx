import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PasswordInput, PasswordStrength, UnlockButton } from '@/components/PasswordInput';
import { SecurityWarning, PasswordWarningBanner } from '@/components/SecurityWarning';
import { useToast } from '@/hooks/use-toast';
import { artificialDelay, validatePasswordStrength } from '@/lib/crypto';

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'unlock';
  title: string;
  description?: string;
  onSubmit: (password: string, name?: string) => Promise<boolean>;
  showStrength?: boolean;
  requireStrong?: boolean;
  showNameInput?: boolean;
  namePlaceholder?: string;
}

export function PasswordDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  onSubmit,
  showStrength = false,
  requireStrong = false,
  showNameInput = false,
  namePlaceholder = 'Enter name',
}: PasswordDialogProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { toast } = useToast();
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName('');
      setPassword('');
      setConfirmPassword('');
      setFailedAttempts(0);
    }
  }, [open]);
  
  const handleSubmit = async () => {
    // Validate for create mode
    if (mode === 'create') {
      if (showNameInput && !name.trim()) {
        toast({
          variant: 'destructive',
          title: 'Name required',
          description: 'Please enter a name.',
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
      
      if (requireStrong) {
        const { valid, errors } = validatePasswordStrength(password);
        if (!valid) {
          toast({
            variant: 'destructive',
            title: 'Password too weak',
            description: errors[0],
          });
          return;
        }
      }
    }
    
    setLoading(true);
    
    try {
      // Add artificial delay for unlock attempts (brute-force protection)
      if (mode === 'unlock' && failedAttempts > 0) {
        const delay = Math.min(failedAttempts * 1000, 5000);
        await artificialDelay(delay);
      }
      
      const success = await onSubmit(password, name.trim() || undefined);
      
      if (!success) {
        setFailedAttempts(prev => prev + 1);
        toast({
          variant: 'destructive',
          title: 'Incorrect password',
          description: failedAttempts >= 2 
            ? 'Multiple failed attempts detected. Delays will be applied.'
            : 'Please check your password and try again.',
        });
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-card border-border"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {mode === 'create' && <PasswordWarningBanner />}
          
          {mode === 'create' && showNameInput && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                autoFocus
                disabled={loading}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === 'create' ? 'Create a strong password' : 'Enter password'}
              autoFocus={!showNameInput}
              disabled={loading}
            />
          </div>
          
          {mode === 'create' && showStrength && (
            <PasswordStrength password={password} />
          )}
          
          {mode === 'create' && (
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm your password"
                disabled={loading}
              />
            </div>
          )}
          
          {failedAttempts >= 3 && (
            <SecurityWarning variant="critical">
              <p>
                <strong>Multiple failed attempts.</strong> A {Math.min(failedAttempts, 5)}-second 
                delay will be applied to each attempt.
              </p>
            </SecurityWarning>
          )}
          
          <UnlockButton
            onClick={handleSubmit}
            loading={loading}
            disabled={!password || (mode === 'create' && !confirmPassword) || (mode === 'create' && showNameInput && !name.trim())}
          >
            {mode === 'create' ? 'Create' : 'Unlock'}
          </UnlockButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
