import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from './Layout';
import { api } from '../api';
import { Person } from '../types';

const PeopleDirectory: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [peopleData, statsData] = await Promise.all([
          api.listPeople(new URLSearchParams({ limit: '500' })),
          api.getPeopleStats()
        ]);
        setPeople(peopleData);
        setFilteredPeople(peopleData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch people data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = people.filter(person =>
        person.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.role_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.organization?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredPeople(filtered);
    } else {
      setFilteredPeople(people);
    }
  }, [searchQuery, people]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
            <p className="mt-2 text-amber-700 font-serif italic">Assembling passenger manifest...</p>
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
            <h2 className="text-2xl font-bold leading-7 text-amber-900 sm:text-3xl sm:truncate font-serif">
              Passenger Manifest
            </h2>
            <p className="mt-1 text-sm text-amber-700 font-serif italic">
              Distinguished guests, crew, and officials who sailed aboard the USS Sequoia
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-amber-50/80 overflow-hidden shadow-lg rounded-lg border-2 border-amber-200/60 backdrop-blur-sm">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-semibold text-amber-700 truncate font-serif">Total People</dt>
                      <dd className="text-lg font-bold text-amber-900 font-serif">{stats.total_people}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/80 overflow-hidden shadow-lg rounded-lg border-2 border-amber-200/60 backdrop-blur-sm">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">🚢</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-semibold text-amber-700 truncate font-serif">Voyage Records</dt>
                      <dd className="text-lg font-bold text-amber-900 font-serif">{stats.total_passenger_records}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/80 overflow-hidden shadow-lg rounded-lg border-2 border-amber-200/60 backdrop-blur-sm">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">💼</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-semibold text-amber-700 truncate font-serif">Unique Roles</dt>
                      <dd className="text-lg font-bold text-amber-900 font-serif">{stats.by_role?.length || 0}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/80 overflow-hidden shadow-lg rounded-lg border-2 border-amber-200/60 backdrop-blur-sm">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-semibold text-amber-700 truncate font-serif">Search Results</dt>
                      <dd className="text-lg font-bold text-amber-900 font-serif">{filteredPeople.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mt-6">
          <div className="max-w-md">
            <label htmlFor="search" className="sr-only">Search people</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
              <input
                type="text"
                id="search"
                className="block w-full pl-10 pr-3 py-2 border-2 border-amber-300/60 rounded-md leading-5 bg-amber-50/80 placeholder-amber-700/60 focus:outline-none focus:placeholder-amber-600/80 focus:ring-2 focus:ring-amber-600 focus:border-amber-600 sm:text-sm text-amber-900 font-serif backdrop-blur-sm shadow-lg"
                placeholder="Search by name, role, or organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* People Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => (
            <div key={person.person_slug} className="bg-amber-50/80 overflow-hidden shadow-lg rounded-lg hover:shadow-xl transition-shadow border-2 border-amber-200/60 backdrop-blur-sm hover:bg-amber-50/90">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-amber-200/60 flex items-center justify-center border-2 border-amber-300/60">
                      <span className="text-amber-800 font-bold text-sm font-serif">
                        {person.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <Link 
                        to={`/people/${person.person_slug}`}
                        className="text-sm font-bold text-amber-900 hover:text-amber-700 font-serif"
                      >
                        {person.full_name}
                      </Link>
                    </div>
                    {person.role_title && (
                      <p className="text-sm text-amber-700 font-serif">{person.role_title}</p>
                    )}
                    {person.organization && (
                      <p className="text-xs text-amber-600 mt-1 font-serif italic">{person.organization}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-2 text-xs text-amber-600 font-serif">
                      {person.birth_year && (
                        <span>Born: {person.birth_year}</span>
                      )}
                      {person.birth_year && person.death_year && <span>•</span>}
                      {person.death_year && (
                        <span>Died: {person.death_year}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPeople.length === 0 && !loading && (
          <div className="text-center py-12">
            <span className="text-4xl">🔍</span>
            <h3 className="mt-2 text-sm font-bold text-amber-900 font-serif">No passengers found</h3>
            <p className="mt-1 text-sm text-amber-700 font-serif italic">
              Try adjusting your search terms or browse all passengers.
            </p>
          </div>
        )}

        {/* Top Roles */}
        {stats?.by_role && (
          <div className="mt-8">
            <h3 className="text-lg font-bold text-amber-900 mb-4 font-serif">Most Distinguished Roles</h3>
            <div className="bg-amber-50/80 shadow-lg overflow-hidden sm:rounded-md border-2 border-amber-200/60 backdrop-blur-sm">
              <ul className="divide-y divide-amber-200/60">
                {stats.by_role.slice(0, 10).map((role: any, index: number) => (
                  <li key={role.capacity_role} className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm font-bold text-amber-900 mr-2 font-serif">
                        {index + 1}.
                      </div>
                      <div>
                        <div className="text-sm font-bold text-amber-900 font-serif">{role.capacity_role}</div>
                        <div className="text-sm text-amber-700 font-serif">
                          {role.unique_people} people, {role.voyage_count} voyages
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-amber-700 font-serif">
                      {role.count} records
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PeopleDirectory;