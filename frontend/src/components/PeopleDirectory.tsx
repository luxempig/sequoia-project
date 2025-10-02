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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading passengers...</p>
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
              Passengers
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Distinguished guests, crew, and officials who sailed aboard the USS Sequoia
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
              <div className="p-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total People</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.total_people}</dd>
                </dl>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
              <div className="p-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Unique Titles</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.unique_titles || 0}</dd>
                </dl>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
              <div className="p-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Voyages per Person</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.avg_voyages_per_passenger || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Help Needed Banner */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm text-gray-700">
            In addition to currently unresearched voyages, we need help migrating data from{' '}
            <a
              href="https://docs.google.com/document/d/1i6zyig7Tg84fGmH8mU9wfQMPbZZ3_iwxf64LWbKgh6Y/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              this Google doc
            </a>
            ! Feel free to use the{' '}
            <Link to="/curators" className="text-blue-600 hover:text-blue-800 underline font-medium">
              curator page
            </Link>
            {' '}to fill in missing information.
          </p>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="max-w-md">
            <label htmlFor="search" className="sr-only">Search people</label>
            <input
              type="text"
              id="search"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Search by name, role, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* People Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => (
            <div key={person.person_slug} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-sm">
                        {person.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <Link 
                        to={`/people/${person.person_slug}`}
                        className="text-sm font-medium text-gray-900 hover:text-gray-700"
                      >
                        {person.full_name}
                      </Link>
                    </div>
                    {person.role_title && (
                      <p className="text-sm text-gray-500">{person.role_title}</p>
                    )}
                    {person.organization && (
                      <p className="text-xs text-gray-400 mt-1">{person.organization}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No passengers found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search terms or browse all passengers.
            </p>
          </div>
        )}

        {/* Top Roles */}
        {stats?.by_role && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Common Roles</h3>
            <div className="bg-white shadow rounded-md border border-gray-200">
              <ul className="divide-y divide-gray-200">
                {stats.by_role.slice(0, 10).map((role: any, index: number) => (
                  <li key={role.capacity_role} className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-600 mr-2">
                        {index + 1}.
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{role.capacity_role}</div>
                        <div className="text-sm text-gray-500">
                          {role.unique_people} people, {role.voyage_count} voyages
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
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