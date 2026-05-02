import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center space-x-2 mb-4">
              <svg className="h-8 w-8" viewBox="0 0 40 40">
                <defs>
                  <linearGradient id="footer-logo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0066FF" />
                    <stop offset="100%" stopColor="#00D4AA" />
                  </linearGradient>
                </defs>
                <circle cx="20" cy="20" r="18" fill="url(#footer-logo)" />
                <path d="M14 20h12M20 14v12" stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="font-display font-bold text-xl text-gradient">JetMed</span>
            </Link>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Medicine at the speed of need. Fast, reliable prescription delivery.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/medicines" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">Browse Medicines</Link></li>
              <li><Link to="/medicines?rx=prescription_required" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">Prescription Medicines</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Account</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/orders" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">My Orders</Link></li>
              <li><Link to="/prescriptions" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">Prescriptions</Link></li>
              <li><Link to="/profile" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">Profile</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:support@jetmed.com" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">support@jetmed.com</a></li>
              <li><a href="tel:+15551234567" className="text-gray-600 dark:text-gray-400 hover:text-primary-600">+1 (555) 123-4567</a></li>
              <li><span className="text-gray-600 dark:text-gray-400">Privacy policy available on request</span></li>
              <li><span className="text-gray-600 dark:text-gray-400">Terms shared at onboarding</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 mt-8 pt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} JetMed. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
