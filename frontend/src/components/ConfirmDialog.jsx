import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  isDanger = true,
  onConfirm,
  onCancel
}) {
  // ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="shadcn-dialog-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-desc"
    >
      <div className="shadcn-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9999px',
              backgroundColor: isDanger ? 'var(--destructive-red-muted)' : 'var(--warning-amber-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isDanger ? (
              <AlertCircle size={18} color="var(--destructive-red)" />
            ) : (
              <AlertTriangle size={18} color="var(--warning-amber)" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2
              id="alert-dialog-title"
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                margin: '0 0 0.375rem 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.3
              }}
            >
              {title}
            </h2>
            <p
              id="alert-dialog-desc"
              style={{
                fontSize: '0.875rem',
                color: 'hsl(var(--muted-foreground))',
                margin: 0,
                lineHeight: 1.5
              }}
            >
              {message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            onClick={onCancel}
            className="shadcn-btn btn-outline"
            style={{ minWidth: '80px' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`shadcn-btn ${isDanger ? 'btn-destructive' : 'btn-default'}`}
            style={{ minWidth: '110px' }}
            autoFocus
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
