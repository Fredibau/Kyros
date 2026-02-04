type ErrorAlertProps = {
  message?: string | null;
  onDismiss?: () => void;
  className?: string;
};

export default function ErrorAlert({ message, onDismiss, className = "" }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 ${className}`}
      role="alert"
    >
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-200/80 hover:text-red-100 transition-colors"
          aria-label="Dismiss error"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

