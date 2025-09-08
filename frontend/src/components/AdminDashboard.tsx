import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { api } from '../api';

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboard, timeline] = await Promise.all([
          api.get('/api/analytics/dashboard'),
          api.get('/api/analytics/timeline')
        ]);
        setDashboardData(dashboard);
        setTimelineData(timeline);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'timeline', name: 'Timeline', icon: '📅' },
    { id: 'analytics', name: 'Analytics', icon: '📈' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Admin Dashboard
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Overview and analytics for the USS Sequoia Archive
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <div className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && dashboardData && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">🚢</span>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Voyages</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboardData.totals?.total_voyages || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">🎩</span>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Presidents</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboardData.totals?.total_presidents || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">👥</span>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">People</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboardData.totals?.total_people || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">📸</span>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Media Items</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboardData.totals?.total_media || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Distribution Charts */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Voyage Types */}
                {dashboardData.distributions?.voyage_types && (
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Voyage Types</h3>
                    </div>
                    <div className="border-t border-gray-200">
                      <div className="divide-y divide-gray-200">
                        {dashboardData.distributions.voyage_types.map((type: any, index: number) => (
                          <div key={type.voyage_type} className="px-4 py-4 flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-900 capitalize">{type.voyage_type}</div>
                            <div className="text-sm text-gray-500">{type.count} voyages</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Media Types */}
                {dashboardData.distributions?.media_types && (
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Media Types</h3>
                    </div>
                    <div className="border-t border-gray-200">
                      <div className="divide-y divide-gray-200">
                        {dashboardData.distributions.media_types.map((type: any, index: number) => (
                          <div key={type.media_type} className="px-4 py-4 flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-900 capitalize">{type.media_type}</div>
                            <div className="text-sm text-gray-500">{type.count} items</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Top Presidents */}
              {dashboardData.top_presidents && (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Most Active Presidents</h3>
                    <p className="mt-1 text-sm text-gray-500">Presidents with the most recorded voyages</p>
                  </div>
                  <div className="border-t border-gray-200">
                    <div className="divide-y divide-gray-200">
                      {dashboardData.top_presidents.map((president: any, index: number) => (
                        <div key={president.full_name} className="px-4 py-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900 mr-2">{index + 1}.</div>
                            <div className="text-sm font-medium text-gray-900">{president.full_name}</div>
                          </div>
                          <div className="text-sm text-gray-500">{president.voyage_count} voyages</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Voyage Timeline</h3>
                  <p className="mt-1 text-sm text-gray-500">Chronological view of all voyages</p>
                </div>
                <div className="border-t border-gray-200">
                  <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {timelineData.map((voyage: any) => (
                      <div key={voyage.voyage_slug} className="px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{voyage.title}</div>
                            <div className="text-xs text-gray-500">
                              {voyage.start_date} • {voyage.president_name} ({voyage.president_party})
                            </div>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              voyage.voyage_type === 'official' ? 'bg-blue-100 text-blue-800' :
                              voyage.voyage_type === 'private' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {voyage.voyage_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && dashboardData && (
            <div className="space-y-6">
              {/* Recent Activity */}
              {dashboardData.recent_activity && (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
                    <p className="mt-1 text-sm text-gray-500">Latest additions to the archive</p>
                  </div>
                  <div className="border-t border-gray-200">
                    <div className="divide-y divide-gray-200">
                      {dashboardData.recent_activity.map((activity: any, index: number) => (
                        <div key={index} className="px-4 py-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <span className="text-sm">
                                {activity.type === 'voyage' ? '🚢' :
                                 activity.type === 'media' ? '📸' :
                                 activity.type === 'person' ? '👤' : '📄'}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{activity.name}</div>
                              <div className="text-xs text-gray-500 capitalize">{activity.type}</div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(activity.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* System Info */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">System Information</h3>
                </div>
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Database Schema</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">sequoia</dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Total Passenger Records</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{dashboardData.totals?.total_passengers || 0}</dd>
                    </div>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Data Sources</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        Google Sheets, AWS S3, Historical Archives
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;