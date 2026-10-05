import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-[400px] px-4 space-y-2 pointer-events-none pt-[env(safe-area-inset-top,0px)]">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            className="pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl bg-[#0B2B26]/95 backdrop-blur-md border border-[#235347] shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-xs text-[#DAF1DE] animate-in fade-in slide-in-from-top-3 duration-200 cursor-pointer touch-press"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isSuccess 
                  ? 'bg-emerald-950/60 border border-emerald-600/40 text-emerald-400' 
                  : isError
                  ? 'bg-rose-950/60 border border-rose-600/40 text-rose-400'
                  : 'bg-[#163832] border border-[#235347] text-[#8EB69B]'
              }`}>
                {isSuccess ? <CheckCircle2 size={15} /> : isError ? <AlertCircle size={15} /> : <Info size={15} />}
              </div>
              <span className="font-medium truncate">{toast.message}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="p-1 rounded-lg text-[#8EB69B] hover:text-[#DAF1DE] ml-2 flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
