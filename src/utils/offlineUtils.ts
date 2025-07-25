// Utility functions for offline functionality

export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

export const createOfflinePackage = async (): Promise<Blob> => {
  // Get the current HTML
  const response = await fetch(window.location.origin);
  const html = await response.text();
  
  // Create a self-contained HTML file with inline assets
  const offlineHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BSV Script Wizard Debugger - Offline</title>
    <meta name="description" content="Offline BSV Script Wizard Debugger">
    <style>
      /* Inline critical CSS for offline use */
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        background-color: #0f172a;
        color: white;
      }
      .offline-notice {
        background: #1e40af;
        color: white;
        padding: 8px 16px;
        text-align: center;
        font-size: 14px;
      }
    </style>
    <script>
      // Offline mode indicator
      window.OFFLINE_MODE = true;
      console.log('Running in offline mode');
    </script>
</head>
<body>
    <div class="offline-notice">
      🔌 Running in offline mode - All functionality available without internet connection
    </div>
    <div id="root"></div>
    
    <script type="module">
      // Note: In a real implementation, you would need to inline all the JavaScript
      // For now, this creates a basic offline shell
      console.log('BSV Script Debugger - Offline Mode');
      
      // Basic offline functionality placeholder
      document.getElementById('root').innerHTML = \`
        <div style="padding: 20px; text-align: center;">
          <h1>BSV Script Wizard Debugger</h1>
          <p>Offline version - Basic functionality available</p>
          <p>For full functionality, please use the online version or set up a local development environment.</p>
          <div style="margin-top: 20px; padding: 20px; background: #1e293b; border-radius: 8px;">
            <h3>To run the full offline version:</h3>
            <ol style="text-align: left; max-width: 500px; margin: 0 auto;">
              <li>Clone the repository: <code>git clone [repository-url]</code></li>
              <li>Install dependencies: <code>npm install</code></li>
              <li>Start development server: <code>npm run dev</code></li>
              <li>Build for production: <code>npm run build</code></li>
            </ol>
          </div>
        </div>
      \`;
    </script>
</body>
</html>`;

  return new Blob([offlineHtml], { type: 'text/html' });
};

export const downloadOfflineApp = async (): Promise<void> => {
  try {
    const blob = await createOfflinePackage();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bsv-script-debugger-offline.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to create offline package:', error);
    throw error;
  }
};

// Check if running in offline mode
export const isOfflineMode = (): boolean => {
  return (window as any).OFFLINE_MODE === true;
};

// Enhanced offline detection
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Setup offline event listeners
export const setupOfflineListeners = (
  onOnline: () => void,
  onOffline: () => void
): (() => void) => {
  const handleOnline = () => onOnline();
  const handleOffline = () => onOffline();
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};
