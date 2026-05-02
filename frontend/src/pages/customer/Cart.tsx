import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrashIcon,
  PlusIcon,
  MinusIcon,
  ShoppingBagIcon,
  TruckIcon,
  ShieldCheckIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { useAppSelector, useAppDispatch } from '../../features/hooks';
import {
  selectCartItems,
  selectPromoCode,
  selectPromoDiscount,
  removeFromCart,
  incrementQuantity,
  decrementQuantity,
  applyPromoCode,
  removePromoCode,
} from '../../features/cart/cartSlice';

export default function Cart() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // Get cart data from Redux store
  const cartItems = useAppSelector(selectCartItems);
  const appliedPromoCode = useAppSelector(selectPromoCode);
  const promoDiscount = useAppSelector(selectPromoDiscount);

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');

  const handleRemoveItem = (id: string) => {
    dispatch(removeFromCart(id));
  };

  const handleIncrementQuantity = (id: string) => {
    dispatch(incrementQuantity(id));
  };

  const handleDecrementQuantity = (id: string) => {
    dispatch(decrementQuantity(id));
  };

  const handleApplyPromoCode = () => {
    if (!promoInput.trim()) return;

    // Demo promo codes
    const promoCodes: Record<string, number> = {
      FIRST10: 10,
      SAVE20: 20,
      JETMED15: 15,
    };

    const code = promoInput.toUpperCase();
    if (promoCodes[code]) {
      dispatch(applyPromoCode({ code, discount: promoCodes[code] }));
      setPromoError('');
      setPromoInput('');
    } else {
      setPromoError('Invalid promo code');
    }
  };

  const handleRemovePromo = () => {
    dispatch(removePromoCode());
  };

  // Calculate totals
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.dosageOption.price * item.quantity,
    0
  );
  const deliveryFee = subtotal >= 50 ? 0 : 5.99;
  const platformFee = 1.99;
  const discount = appliedPromoCode ? (subtotal * promoDiscount) / 100 : 0;
  const tax = (subtotal - discount) * 0.08;
  const total = subtotal - discount + deliveryFee + platformFee + tax;

  const hasPrescriptionItems = cartItems.some((item) => item.prescriptionRequired);

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
    } else {
      navigate('/checkout');
    }
  };

  // Empty cart state
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center"
          >
            <ShoppingBagIcon className="w-16 h-16 text-gray-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Looks like you haven't added any medicines yet. Browse our catalog and add items to
            your cart.
          </p>
          <Link
            to="/medicines"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
          >
            Browse Medicines
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Shopping Cart ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {cartItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4"
                >
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <span className="text-4xl">💊</span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link
                            to={`/medicines/${item.slug || item.medicineId}`}
                            className="font-semibold text-gray-900 dark:text-white hover:text-primary-600"
                          >
                            {item.name}
                          </Link>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.genericName}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {item.dosageOption.strength} {item.dosageOption.unit}
                          </p>
                          {item.prescriptionRequired && (
                            <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              Prescription Required
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                          <button
                            onClick={() => handleDecrementQuantity(item.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition disabled:opacity-50"
                            disabled={item.quantity <= 1}
                          >
                            <MinusIcon className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncrementQuantity(item.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition disabled:opacity-50"
                            disabled={item.quantity >= 10}
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Price */}
                        <p className="text-lg font-bold text-primary-600">
                          ${(item.dosageOption.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Promo Code */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <TagIcon className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">Promo Code</span>
              </div>
              {appliedPromoCode ? (
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      {appliedPromoCode}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-500">
                      {promoDiscount}% off applied
                    </p>
                  </div>
                  <button
                    onClick={handleRemovePromo}
                    className="text-red-500 hover:text-red-600 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Enter promo code"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleApplyPromoCode}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Apply
                  </button>
                </div>
              )}
              {promoError && <p className="text-sm text-red-500 mt-2">{promoError}</p>}
              <p className="text-xs text-gray-500 mt-2">Try: FIRST10, SAVE20, or JETMED15</p>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
                <TruckIcon className="w-8 h-8 text-primary-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Free Delivery</p>
                  <p className="text-sm text-gray-500">On orders over $50</p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
                <ShieldCheckIcon className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Secure Checkout</p>
                  <p className="text-sm text-gray-500">256-bit SSL encryption</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Order Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {appliedPromoCode && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({promoDiscount}%)</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                  <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : ''}>
                    {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                  <span>${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tax (8%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-primary-600">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {hasPrescriptionItems && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ Some items require a prescription. You'll need to upload your prescription
                    during checkout.
                  </p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="w-full mt-6 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
              >
                Proceed to Checkout
              </button>

              <p className="text-xs text-center text-gray-500 mt-4">
                By proceeding, you agree to our{' '}
                <Link to="/terms" className="text-primary-600 hover:underline">
                  Terms of Service
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}