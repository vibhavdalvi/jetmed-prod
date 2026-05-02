// ═══════════════════════════════════════════════════════════════════════════════
// JetMed - Firebase Messaging Service Worker
// ═══════════════════════════════════════════════════════════════════════════════
// This file should be placed in public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration (will be replaced during build)
const firebaseConfig = {
  apiKey: self.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',
  authDomain: self.FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: self.FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: self.FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);
  
  const { notification, data } = payload;
  
  // Customize notification based on type
  const notificationOptions = getNotificationOptions(notification, data);
  
  // Show notification
  return self.registration.showNotification(
    notification?.title || 'JetMed',
    notificationOptions
  );
});

// Get notification options based on message type
function getNotificationOptions(notification, data) {
  const baseOptions = {
    body: notification?.body || '',
    icon: '/icons/notification-icon-192.png',
    badge: '/icons/badge-icon-72.png',
    tag: data?.orderId || 'default',
    data: data,
    requireInteraction: false,
    actions: [],
  };
  
  // Customize based on notification type
  switch (data?.type) {
    case 'order_confirmed':
      return {
        ...baseOptions,
        icon: '/icons/order-confirmed.png',
        actions: [
          { action: 'view', title: 'View Order' },
        ],
      };
    
    case 'order_out_for_delivery':
      return {
        ...baseOptions,
        icon: '/icons/delivery.png',
        requireInteraction: true,
        actions: [
          { action: 'track', title: 'Track Delivery' },
        ],
      };
    
    case 'order_delivered':
      return {
        ...baseOptions,
        icon: '/icons/delivered.png',
        actions: [
          { action: 'rate', title: 'Rate Order' },
          { action: 'view', title: 'View Details' },
        ],
      };
    
    case 'prescription_rejected':
      return {
        ...baseOptions,
        icon: '/icons/prescription-alert.png',
        requireInteraction: true,
        actions: [
          { action: 'resubmit', title: 'Resubmit' },
          { action: 'contact', title: 'Contact Pharmacist' },
        ],
      };
    
    case 'incoming_call':
      return {
        ...baseOptions,
        icon: '/icons/call.png',
        requireInteraction: true,
        tag: `call-${data?.orderId}`,
        actions: [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' },
        ],
      };
    
    case 'new_order':
      return {
        ...baseOptions,
        icon: '/icons/new-order.png',
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'View Order' },
        ],
      };
    
    case 'delivery_assigned':
      return {
        ...baseOptions,
        icon: '/icons/delivery-assigned.png',
        actions: [
          { action: 'navigate', title: 'Start Navigation' },
          { action: 'view', title: 'View Details' },
        ],
      };
    
    default:
      return baseOptions;
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  let url = '/';
  
  // Determine URL based on action and notification type
  if (action === 'view' || action === 'track') {
    if (data.orderId) {
      url = `/orders/${data.orderId}`;
    }
  } else if (action === 'rate' && data.orderId) {
    url = `/orders/${data.orderId}/rate`;
  } else if (action === 'resubmit' && data.orderId) {
    url = `/orders/${data.orderId}/prescription`;
  } else if (action === 'contact' && data.orderId) {
    url = `/orders/${data.orderId}/contact`;
  } else if (action === 'answer' && data.orderId) {
    url = `/call/${data.orderId}`;
  } else if (action === 'navigate' && data.orderId) {
    url = `/delivery/orders/${data.orderId}/navigate`;
  } else {
    // Default actions based on type
    switch (data.type) {
      case 'order_confirmed':
      case 'order_approved':
      case 'order_out_for_delivery':
      case 'order_delivered':
        url = data.orderId ? `/orders/${data.orderId}` : '/orders';
        break;
      case 'new_order':
        url = '/pharmacist/orders';
        break;
      case 'delivery_assigned':
        url = '/delivery/orders';
        break;
      case 'incoming_call':
        url = data.orderId ? `/call/${data.orderId}` : '/';
        break;
    }
  }
  
  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.data);
  
  // Track notification dismissal if needed
  const data = event.notification.data;
  if (data?.orderId) {
    // Could send analytics event here
  }
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim());
});
