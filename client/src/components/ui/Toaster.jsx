import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function Toaster({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, description, variant = 'default' }) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const variantStyles = {
    default: 'border-brand-300/30 bg-[#1e2a40] text-brand-50',
    destructive: 'border-red-500/30 bg-red-950/80 text-red-200',
    success: 'border-green-500/30 bg-green-950/80 text-green-200',
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border p-4 shadow-xl transition-all animate-in ${variantStyles[t.variant] || variantStyles.default}`}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-semibold text-sm">{t.title}</p>
                {t.description && (
                  <p className="text-xs opacity-80 mt-0.5">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-current opacity-50 hover:opacity-100 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
