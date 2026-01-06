import React, { useState, useEffect } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Edit2,
  Power,
  Send,
  Eye,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  AlertCircle,
  List,
} from 'lucide-react';
import { useToast } from '../lib/toast';
import {
  getWebhookConfigs,
  createWebhookConfig,
  updateWebhookConfig,
  deleteWebhookConfig,
  sendTestWebhook,
  getWebhookLogs,
  regenerateSecretKey,
  getWebhookStats,
  getWebhookQueue,
  getDispatcherStatus,
  forceProcessWebhooks,
  WEBHOOK_EVENTS,
  type WebhookConfig,
  type WebhookDeliveryLog,
  type WebhookEventQueue,
  type WebhookDispatcherStatus,
} from '../services/webhookService';

export default function WebhookPanel() {
  const { showToast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [queue, setQueue] = useState<WebhookEventQueue[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dispatcherStatus, setDispatcherStatus] = useState<WebhookDispatcherStatus | null>(null);
  const [forcingProcess, setForcingProcess] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    url: string;
    events: string[];
    headers: Record<string, string>;
    http_method: string;
  }>({
    name: '',
    url: '',
    events: [WEBHOOK_EVENTS.CLIENT_CREATED],
    headers: {},
    http_method: 'POST',
  });

  useEffect(() => {
    loadWebhooks();
    loadDispatcherStatus();

    const interval = setInterval(() => {
      loadDispatcherStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const validateUrl = (url: string): string | null => {
    if (!url) return null;

    if (!url.startsWith('https://')) {
      if (url.startsWith('http://')) {
        return 'Only HTTPS URLs are allowed for security. Please use https:// instead of http://';
      }
      return 'URL must start with https://';
    }

    try {
      new URL(url);
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  };

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, url });
    const error = validateUrl(url);
    setUrlError(error);
  };

  const loadWebhooks = async () => {
    try {
      const data = await getWebhookConfigs();
      setWebhooks(data);

      // Load stats for each webhook
      const statsData: Record<string, any> = {};
      for (const webhook of data) {
        statsData[webhook.id] = await getWebhookStats(webhook.id);
      }
      setStats(statsData);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      showToast('Failed to load webhooks', 'error');
    }
  };

  const loadDispatcherStatus = async () => {
    try {
      const status = await getDispatcherStatus();
      setDispatcherStatus(status);
    } catch (error) {
      console.error('Error loading dispatcher status:', error);
    }
  };

  const handleForceProcess = async () => {
    setForcingProcess(true);
    try {
      const result = await forceProcessWebhooks();
      if (result.success) {
        showToast(result.message, 'success');
        await loadDispatcherStatus();
        await loadWebhooks();
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('Error forcing webhook processing:', error);
      showToast('Failed to process webhooks', 'error');
    } finally {
      setForcingProcess(false);
    }
  };

  const loadLogs = async (webhookId: string) => {
    try {
      const data = await getWebhookLogs(webhookId);
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
      showToast('Failed to load webhook logs', 'error');
    }
  };

  const loadQueue = async (webhookId: string) => {
    try {
      const data = await getWebhookQueue(webhookId);
      setQueue(data);
    } catch (error) {
      console.error('Error loading queue:', error);
      showToast('Failed to load webhook queue', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate URL before submission
    const urlValidationError = validateUrl(formData.url);
    if (urlValidationError) {
      setUrlError(urlValidationError);
      showToast(urlValidationError, 'error');
      return;
    }

    setLoading(true);

    try {
      if (selectedWebhook) {
        await updateWebhookConfig(selectedWebhook.id, formData);
        showToast('Webhook updated successfully', 'success');
      } else {
        const newWebhook = await createWebhookConfig(formData);
        showToast('Webhook created successfully', 'success');
        setShowSecretKey(newWebhook.secret_key);
      }
      await loadWebhooks();
      if (!showSecretKey) {
        setShowModal(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving webhook:', error);
      showToast('Failed to save webhook', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await deleteWebhookConfig(id);
      showToast('Webhook deleted successfully', 'success');
      await loadWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      showToast('Failed to delete webhook', 'error');
    }
  };

  const handleToggleEnabled = async (webhook: WebhookConfig) => {
    try {
      await updateWebhookConfig(webhook.id, { enabled: !webhook.enabled });
      showToast(`Webhook ${webhook.enabled ? 'disabled' : 'enabled'}`, 'success');
      await loadWebhooks();
    } catch (error) {
      console.error('Error toggling webhook:', error);
      showToast('Failed to update webhook', 'error');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId);
    try {
      const result = await sendTestWebhook(webhookId);
      if (result.success) {
        showToast(
          `Test successful! Response: ${result.statusCode} (${result.duration})`,
          'success'
        );
      } else {
        // Provide more detailed error messages based on error type
        let errorMessage = result.error || 'Unknown error';

        if (result.errorType === 'timeout') {
          errorMessage = 'Request timed out after 10 seconds. Please check if your endpoint is responding.';
        } else if (result.errorType === 'dns_error') {
          errorMessage = 'Could not resolve hostname. Please check the URL is correct.';
        } else if (result.errorType === 'ssl_error') {
          errorMessage = 'SSL certificate error. Please ensure your endpoint has a valid HTTPS certificate.';
        } else if (result.errorType === 'connection_error') {
          errorMessage = 'Failed to connect to webhook URL. Please verify the URL is accessible.';
        }

        showToast(`Test failed: ${errorMessage}`, 'error');
      }

      // Reload webhooks to update stats
      await loadWebhooks();
    } catch (error) {
      console.error('Error testing webhook:', error);
      showToast('Failed to test webhook. Please try again.', 'error');
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleRegenerateSecret = async (webhookId: string) => {
    if (!confirm('This will invalidate the current secret key. Continue?')) return;

    try {
      const newSecret = await regenerateSecretKey(webhookId);
      setShowSecretKey(newSecret);
      showToast('Secret key regenerated', 'success');
      await loadWebhooks();
    } catch (error) {
      console.error('Error regenerating secret:', error);
      showToast('Failed to regenerate secret key', 'error');
    }
  };

  const handleViewLogs = async (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    await loadLogs(webhook.id);
    setShowLogsModal(true);
  };

  const handleViewQueue = async (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    await loadQueue(webhook.id);
    setShowQueueModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [WEBHOOK_EVENTS.CLIENT_CREATED],
      headers: {},
      http_method: 'POST',
    });
    setSelectedWebhook(null);
    setUrlError(null);
  };

  const openEditModal = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      headers: webhook.headers,
      http_method: webhook.http_method || 'POST',
    });
    setShowModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  const eventOptions = [
    { value: WEBHOOK_EVENTS.CLIENT_CREATED, label: 'Client Created' },
    { value: WEBHOOK_EVENTS.CLIENT_UPDATED, label: 'Client Updated' },
    { value: WEBHOOK_EVENTS.CLIENT_DELETED, label: 'Client Deleted' },
    { value: WEBHOOK_EVENTS.CLIENT_STATUS_CHANGED, label: 'Client Status Changed' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Webhook className="w-7 h-7" />
            Webhooks
          </h2>
          <p className="text-gray-600 mt-1">
            Configure webhooks to receive real-time notifications when events occur
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {dispatcherStatus && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow p-6 mb-6 border border-blue-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Activity className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">Automatic Webhook Dispatcher</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                    dispatcherStatus.enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    dispatcherStatus.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`} />
                  {dispatcherStatus.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-4">
                Webhooks are processed automatically when events occur. Database triggers call the dispatcher
                with {dispatcherStatus.debounce_seconds}s debounce to prevent excessive calls.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-gray-600">Pending Events</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {dispatcherStatus.pending_events}
                  </div>
                  {dispatcherStatus.pending_events > 10 && (
                    <p className="text-xs text-yellow-600 mt-1">Queue is building up</p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    {dispatcherStatus.last_run_success === null ? (
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                    ) : dispatcherStatus.last_run_success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-xs font-medium text-gray-600">Last Run</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {dispatcherStatus.last_run_at
                      ? new Date(dispatcherStatus.last_run_at).toLocaleTimeString()
                      : 'Never'}
                  </div>
                  {dispatcherStatus.last_run_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.floor((Date.now() - new Date(dispatcherStatus.last_run_at).getTime()) / 1000)}s ago
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-gray-600">Status</span>
                  </div>
                  {dispatcherStatus.last_run_success === null ? (
                    <div className="text-sm font-semibold text-gray-600">Waiting for events</div>
                  ) : dispatcherStatus.last_run_success ? (
                    <div className="text-sm font-semibold text-green-600">Running smoothly</div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold text-red-600">Last run failed</div>
                      {dispatcherStatus.last_run_error && (
                        <p className="text-xs text-red-500 mt-1 line-clamp-2">
                          {dispatcherStatus.last_run_error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="ml-4">
              <button
                onClick={handleForceProcess}
                disabled={forcingProcess || dispatcherStatus.pending_events === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={dispatcherStatus.pending_events === 0 ? 'No pending events' : 'Process pending webhooks now'}
              >
                {forcingProcess ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Processing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="text-sm font-medium">Force Process</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Webhook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No webhooks configured</h3>
          <p className="text-gray-600 mb-4">
            Create your first webhook to start receiving event notifications
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{webhook.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        webhook.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {webhook.enabled ? 'Active' : 'Disabled'}
                    </span>
                    {webhook.failure_count > 0 && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {webhook.failure_count} failures
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <code className="bg-gray-100 px-2 py-1 rounded">{webhook.url}</code>
                    <button
                      onClick={() => copyToClipboard(webhook.url)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        {event}
                      </span>
                    ))}
                  </div>

                  {stats[webhook.id] && (
                    <div className="flex gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        <span>{stats[webhook.id].totalDeliveries} deliveries</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>{stats[webhook.id].successCount} success</span>
                      </div>
                      {stats[webhook.id].failureCount > 0 && (
                        <div className="flex items-center gap-1">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span>{stats[webhook.id].failureCount} failed</span>
                        </div>
                      )}
                      {stats[webhook.id].averageDuration > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{stats[webhook.id].averageDuration}ms avg</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleEnabled(webhook)}
                    className={`p-2 rounded hover:bg-gray-100 ${
                      webhook.enabled ? 'text-green-600' : 'text-gray-400'
                    }`}
                    title={webhook.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testingWebhook === webhook.id}
                    className="p-2 rounded hover:bg-gray-100 text-blue-600 disabled:opacity-50"
                    title="Send Test"
                  >
                    {testingWebhook === webhook.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleViewLogs(webhook)}
                    className="p-2 rounded hover:bg-gray-100 text-gray-600"
                    title="View Logs"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleViewQueue(webhook)}
                    className="p-2 rounded hover:bg-gray-100 text-purple-600"
                    title="View Event Queue"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(webhook)}
                    className="p-2 rounded hover:bg-gray-100 text-gray-600"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-2 rounded hover:bg-gray-100 text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {selectedWebhook ? 'Edit Webhook' : 'Create New Webhook'}
              </h3>

              {showSecretKey ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                      <CheckCircle className="w-5 h-5" />
                      Webhook created successfully!
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                      Save this secret key securely. You won't be able to see it again.
                    </p>
                    <div className="bg-white border border-green-300 rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-sm break-all">{showSecretKey}</code>
                        <button
                          onClick={() => copyToClipboard(showSecretKey)}
                          className="text-green-600 hover:text-green-700 flex-shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowSecretKey(null);
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="My Integration"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination URL
                    </label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        urlError
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                      placeholder="https://your-app.com/webhook"
                      required
                    />
                    {urlError ? (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {urlError}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        Must be a valid HTTPS URL for security
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      HTTP Method
                    </label>
                    <select
                      value={formData.http_method}
                      onChange={(e) => setFormData({ ...formData, http_method: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      HTTP method to use when sending webhook requests
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Events to Monitor
                    </label>
                    <div className="space-y-2">
                      {eventOptions.map((event) => (
                        <label key={event.value} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.events.includes(event.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  events: [...formData.events, event.value],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  events: formData.events.filter((ev) => ev !== event.value),
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">{event.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Headers (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Add custom HTTP headers to your webhook requests. Common uses include Authorization tokens, API keys, or custom identifiers.
                    </p>

                    <div className="space-y-2">
                      {Object.entries(formData.headers).map(([key, value], index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => {
                              const newHeaders = { ...formData.headers };
                              delete newHeaders[key];
                              if (e.target.value.trim()) {
                                newHeaders[e.target.value] = value;
                              }
                              setFormData({ ...formData, headers: newHeaders });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Header name (e.g., Authorization)"
                          />
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                              const newHeaders = { ...formData.headers };
                              newHeaders[key] = e.target.value;
                              setFormData({ ...formData, headers: newHeaders });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Header value (e.g., Bearer YOUR_TOKEN)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newHeaders = { ...formData.headers };
                              delete newHeaders[key];
                              setFormData({ ...formData, headers: newHeaders });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remove header"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newKey = `Header-${Object.keys(formData.headers).length + 1}`;
                        setFormData({
                          ...formData,
                          headers: { ...formData.headers, [newKey]: '' },
                        });
                      }}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Header
                    </button>

                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800 font-medium mb-1">Examples:</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li><code className="bg-blue-100 px-1 rounded">Authorization: Bearer YOUR_TOKEN</code></li>
                        <li><code className="bg-blue-100 px-1 rounded">X-API-Key: YOUR_API_KEY</code></li>
                        <li><code className="bg-blue-100 px-1 rounded">X-Custom-ID: YOUR_ID</code></li>
                      </ul>
                    </div>
                  </div>

                  {selectedWebhook && (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRegenerateSecret(selectedWebhook.id)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Regenerate Secret Key
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : selectedWebhook ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showLogsModal && selectedWebhook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  Delivery Logs: {selectedWebhook.name}
                </h3>
                <button
                  onClick={() => {
                    setShowLogsModal(false);
                    setLogs([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No delivery logs yet
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-4 ${
                        log.success
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {log.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="font-medium text-gray-800">{log.event_type}</span>
                            {log.status_code && (
                              <span className="text-sm text-gray-600">({log.status_code})</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {log.duration_ms}ms • Attempt {log.attempt_number}
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="text-sm text-red-700 mt-2">
                          Error: {log.error_message}
                        </div>
                      )}

                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                          View payload
                        </summary>
                        <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-x-auto">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showQueueModal && selectedWebhook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  Event Queue: {selectedWebhook.name}
                </h3>
                <button
                  onClick={() => {
                    setShowQueueModal(false);
                    setQueue([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                View pending, processing, and failed webhook events. Events are processed automatically by the system.
              </p>

              {queue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No events in queue
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.map((event) => (
                    <div
                      key={event.id}
                      className={`border rounded-lg p-4 ${
                        event.status === 'completed'
                          ? 'border-green-200 bg-green-50'
                          : event.status === 'failed'
                          ? 'border-red-200 bg-red-50'
                          : event.status === 'processing'
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {event.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : event.status === 'failed' ? (
                              <XCircle className="w-4 h-4 text-red-600" />
                            ) : event.status === 'processing' ? (
                              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                            ) : (
                              <Clock className="w-4 h-4 text-yellow-600" />
                            )}
                            <span className="font-medium text-gray-800">{event.event_type}</span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                event.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : event.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : event.status === 'processing'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {event.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {new Date(event.created_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            Scheduled for: {new Date(event.scheduled_for).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          Attempt {event.attempts} / {event.max_attempts}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        Event ID: <code className="bg-white px-1 rounded">{event.event_id}</code>
                      </div>

                      {event.processed_at && (
                        <div className="text-xs text-gray-500">
                          Processed: {new Date(event.processed_at).toLocaleString()}
                        </div>
                      )}

                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                          View payload
                        </summary>
                        <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-x-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
