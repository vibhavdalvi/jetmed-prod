import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { isProductionMissingRemoteApi } from '../../config/runtime';

export default function MainLayout() {
  const showApiWarning = isProductionMissingRemoteApi();

  return (
    <div className="min-h-screen flex flex-col">
      {showApiWarning && (
        <div
          role="alert"
          className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 text-center"
        >
          <strong>API URL not set for production.</strong> In Vercel → Settings → Environment Variables,
          add <code className="mx-1 rounded bg-white/60 dark:bg-black/30 px-1">VITE_API_URL</code>=
          <code className="mx-1 rounded bg-white/60 dark:bg-black/30 px-1">
            https://YOUR-RENDER-SERVICE.onrender.com/api/v1
          </code>
          for <strong>Production</strong>, then redeploy. Relative <code className="px-1">/api/v1</code> only works
          on localhost.
        </div>
      )}
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
