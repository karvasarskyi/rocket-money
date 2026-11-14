import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import BottomNav from './BottomNav';

export default function Layout({ children, title, hideNav }: { children: ReactNode; title?: string; hideNav?: boolean }) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`max-w-md mx-auto px-4 pt-5 ${hideNav ? 'pb-8' : 'pb-28'}`}
      >
        {title && <h1 className="text-2xl font-bold mb-5">{title}</h1>}
        {children}
      </motion.main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
