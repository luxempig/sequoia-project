import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from './Layout';
import { api } from '../api';

const PersonDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerson = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        const personData = await api.get(`/api/people/${slug}`);
        setPerson(personData);
      } catch (error) {
        console.error('Failed to fetch person:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerson();
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading person details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!person || Object.keys(person).length === 0) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-4xl">❓</span>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Person not found</h3>
            <p className="mt-1 text-sm text-gray-500">
              The person you're looking for doesn't exist or has been removed.
            </p>
            <Link 
              to="/people" 
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Back to People Directory
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-medium text-xl">
                    {person.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
              </div>
              <div className="ml-6">
                <h1 className="text-2xl font-bold text-gray-900">{person.full_name}</h1>
                {person.role_title && (
                  <p className="text-sm text-gray-600 mt-1">{person.role_title}</p>
                )}
                {person.organization && (
                  <p className="text-sm text-gray-500">{person.organization}</p>
                )}
                <div className="mt-2 flex items-center space-x-2 text-sm text-gray-400">
                  {person.birth_year && (
                    <span>Born: {person.birth_year}</span>
                  )}
                  {person.birth_year && person.death_year && <span>•</span>}
                  {person.death_year && (
                    <span>Died: {person.death_year}</span>
                  )}
                  {(person.birth_year || person.death_year) && person.voyage_count && <span>•</span>}
                  {person.voyage_count > 0 && (
                    <span>{person.voyage_count} voyage{person.voyage_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Person Info */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Personal Information</h3>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{person.full_name}</dd>
                  </div>
                  {person.role_title && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Role/Title</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{person.role_title}</dd>
                    </div>
                  )}
                  {person.organization && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Organization</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{person.organization}</dd>
                    </div>
                  )}
                  {(person.birth_year || person.death_year) && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Lifespan</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {person.birth_year || '?'} - {person.death_year || 'present'}
                      </dd>
                    </div>
                  )}
                  {person.wikipedia_url && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Wikipedia</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <a 
                          href={person.wikipedia_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          View Article →
                        </a>
                      </dd>
                    </div>
                  )}
                  {person.tags && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Tags</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{person.tags}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {person.notes_internal && (
              <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Internal Notes</h3>
                  <p className="mt-2 text-sm text-gray-600">{person.notes_internal}</p>
                </div>
              </div>
            )}
          </div>

          {/* Voyage History */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Voyage History ({person.voyage_count} voyages)
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  All documented voyages aboard the USS Sequoia
                </p>
              </div>
              
              {person.voyages && person.voyages.length > 0 ? (
                <div className="border-t border-gray-200">
                  <div className="divide-y divide-gray-200">
                    {person.voyages.map((voyage: any, index: number) => (
                      <div key={voyage.voyage_slug} className="px-4 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Link 
                              to={`/voyages/${voyage.voyage_slug}`}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              {voyage.title}
                            </Link>
                            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                              <span>{voyage.start_date}</span>
                              {voyage.end_date && voyage.end_date !== voyage.start_date && (
                                <>
                                  <span>→</span>
                                  <span>{voyage.end_date}</span>
                                </>
                              )}
                              {voyage.president_name && (
                                <>
                                  <span>•</span>
                                  <span>{voyage.president_name}</span>
                                  {voyage.president_party && (
                                    <span className="text-gray-400">({voyage.president_party})</span>
                                  )}
                                </>
                              )}
                            </div>
                            {voyage.capacity_role && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {voyage.capacity_role}
                                </span>
                              </div>
                            )}
                            {voyage.voyage_notes && (
                              <p className="mt-2 text-sm text-gray-600">{voyage.voyage_notes}</p>
                            )}
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <span className="text-xs text-gray-400">#{index + 1}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-200 px-4 py-5">
                  <div className="text-center">
                    <span className="text-2xl">🚢</span>
                    <p className="mt-2 text-sm text-gray-500">No voyage records found</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PersonDetail;