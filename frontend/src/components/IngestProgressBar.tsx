import React, { useState, useEffect } from 'react';

interface IngestProgress {
  operation_id: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  voyages_processed: number;
  validation_errors: number;
  media_warnings: number;
  error_message?: string;
}

const IngestProgressBar: React.FC = () => {
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [lastChecked, setLastChecked] = useState<number>(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkIngestStatus = async () => {
      try {
        const response = await fetch('/api/curator/ingest-status');
        if (response.ok) {
          const data = await response.json();

          // Get the most recent active operation
          const activeOp = data.operations?.find((op: IngestProgress) =>
            op.status === 'running' || op.status === 'initializing'
          );

          if (activeOp) {
            setProgress(activeOp);
            setIsVisible(true);
            setLastChecked(Date.now());
          } else if (progress && (progress.status === 'running' || progress.status === 'initializing')) {
            // Check for recently completed operation
            const recentOp = data.operations?.[0];
            if (recentOp && (recentOp.status === 'completed' || recentOp.status === 'failed')) {
              setProgress(recentOp);
              // Auto-hide after 5 seconds
              setTimeout(() => setIsVisible(false), 5000);
            }
          }
        }
      } catch (error) {
        console.error('Failed to check ingest status:', error);
      }
    };

    // Check immediately on mount
    checkIngestStatus();

    // Poll every 2 seconds
    intervalId = setInterval(checkIngestStatus, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [progress]);

  if (!isVisible || !progress) {
    return null;
  }

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'running':
      case 'initializing':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'running':
      case 'initializing':
        return '⏳';
      default:
        return '•';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 shadow-lg">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getStatusIcon()}</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {progress.status === 'completed' ? 'Ingest Completed' :
                   progress.status === 'failed' ? 'Ingest Failed' :
                   'Ingesting Voyage Data'}
                </h3>
                <p className="text-xs text-gray-600">{progress.current_step}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              {progress.voyages_processed > 0 && (
                <span>📊 {progress.voyages_processed} voyages</span>
              )}
              {progress.validation_errors > 0 && (
                <span className="text-orange-600">⚠️ {progress.validation_errors} errors</span>
              )}
              {progress.media_warnings > 0 && (
                <span className="text-yellow-600">⚡ {progress.media_warnings} warnings</span>
              )}
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${getStatusColor()}`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          {progress.error_message && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              {progress.error_message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngestProgressBar;