import { cn, getStatusChip } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'bg-[#FFDAD6] text-[#410002] rounded-xl px-5 py-2.5 text-sm hover:brightness-95 inline-flex items-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  };
  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-lg',
    md: '',
    lg: 'text-base px-6 py-3 rounded-xl',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Badge / Status Chip ──────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  return <span className={getStatusChip(status)}>{status}</span>;
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-[#4A5568]">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5568]">
            {icon}
          </div>
        )}
        <input className={cn('input', icon && 'pl-9', error && 'ring-1 ring-[#BA1A1A]', className)} {...props} />
      </div>
      {error && <p className="text-xs text-[#BA1A1A] flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-[#4A5568]">{label}</label>}
      <select
        className={cn('input appearance-none', error && 'ring-1 ring-[#BA1A1A]', className)}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-[#BA1A1A]">{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-[#4A5568]">{label}</label>}
      <textarea className={cn('input resize-none', className)} {...props} />
      {error && <p className="text-xs text-[#BA1A1A]">{error}</p>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('w-5 h-5 animate-spin text-[#006B58]', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="w-7 h-7" />
        <p className="text-sm text-[#4A5568]">Loading…</p>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon && <div className="text-[#C0C8BB] mb-1">{icon}</div>}
      <h3 className="text-sm font-semibold text-[#1A2332]">{title}</h3>
      {description && <p className="text-xs text-[#4A5568] max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, limit, onPage }: {
  page: number; pages: number; total: number; limit: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs text-[#4A5568]">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#E8EEF4] text-[#1A2332] disabled:opacity-40 hover:bg-[#DCE4EC] transition-colors"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={cn(
                'w-7 h-7 text-xs rounded-lg transition-colors',
                p === page
                  ? 'bg-[#006B58] text-white'
                  : 'bg-[#E8EEF4] text-[#1A2332] hover:bg-[#DCE4EC]'
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#E8EEF4] text-[#1A2332] disabled:opacity-40 hover:bg-[#DCE4EC] transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Modal / Dialog ───────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(26,35,50,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn('relative bg-white rounded-2xl shadow-2xl w-full flex flex-col', sizes[size])}
        style={{ maxHeight: 'calc(100vh - 2rem)', zIndex: 9991 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#C0C8BB]/30 shrink-0">
          <h2 className="font-sans text-base font-semibold text-[#1A2332]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#4A5568] hover:text-[#1A2332] p-1 rounded-lg hover:bg-[#E8EEF4] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon?: ReactNode; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-[#4A5568] font-medium uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-sans font-semibold text-[#1A2332]" style={{ letterSpacing: '-0.02em' }}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-[#4A5568]">{sub}</p>}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-[#F0F4F8] flex items-center justify-center text-[#006B58] shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ headers, children, className }: { headers: string[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[#4A5568] uppercase tracking-wide first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#C0C8BB]/20">{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'group transition-colors',
        onClick && 'cursor-pointer hover:bg-[#E8EEF4]/60',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn('px-4 py-3 text-sm text-[#1A2332] first:pl-0 last:pr-0', className)}>
      {children}
    </td>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, description, action }: {
  title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-sans font-semibold text-[#1A2332]">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-[#4A5568]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Error Boundary Fallback ──────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle className="w-8 h-8 text-[#BA1A1A]" />
      <p className="text-sm font-medium text-[#1A2332]">Something went wrong</p>
      <p className="text-xs text-[#4A5568]">{message ?? 'Failed to load data.'}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}