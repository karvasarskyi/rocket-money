import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ToastType = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed top-4 inset-x-4 z-50 flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className={`pointer-events-auto max-w-sm w-full px-4 py-3 rounded-2xl text-sm font-medium shadow-lg flex items-center gap-2 ${
                t.type === 'success' ? 'bg-accent text-black' : 'bg-red-500 text-white'
              }`}
            >
              <span>{t.type === 'success' ? '✓' : '!'}</span>
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
