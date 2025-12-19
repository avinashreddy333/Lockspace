import { AlertTriangle, Shield, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecurityWarningProps {
  variant?: 'default' | 'critical';
  className?: string;
  children: React.ReactNode;
}

export function SecurityWarning({ variant = 'default', className, children }: SecurityWarningProps) {
  const isCritical = variant === 'critical';
  
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        isCritical 
          ? 'border-warning/30 bg-warning/5 warning-gradient' 
          : 'border-primary/20 bg-primary/5 secure-glow',
        className
      )}
    >
      <div className={cn(
        'flex-shrink-0 rounded-full p-2',
        isCritical ? 'bg-warning/10' : 'bg-primary/10'
      )}>
        {isCritical ? (
          <AlertTriangle className="h-5 w-5 text-warning" />
        ) : (
          <Shield className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </div>
  );
}

export function ZeroKnowledgeBadge({ className }: { className?: string }) {
  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5',
      className
    )}>
      <ShieldAlert className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium text-primary">Zero-Knowledge Encryption</span>
    </div>
  );
}

export function PasswordWarningBanner() {
  return (
    <SecurityWarning variant="critical" className="mb-6">
      <div className="space-y-1">
        <p className="font-semibold text-warning">Important: No Password Recovery</p>
        <p className="text-muted-foreground">
          If you lose your password, your data cannot be recovered. We never store your password 
          or any keys that could decrypt your data. Write your password down and store it safely.
        </p>
      </div>
    </SecurityWarning>
  );
}
