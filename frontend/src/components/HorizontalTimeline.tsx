import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Voyage, MediaItem, President } from "../types";
import { api } from "../api";
import { looksLikeImage, looksLikeVideo } from "../utils/media";

interface TimelineData {
  [year: string]: {
    [month: string]: {
      [day: string]: {
        voyages: Voyage[];
        media: MediaItem[];
      }
    }
  }
}

interface HorizontalTimelineProps {}

const HorizontalTimeline: React.FC<HorizontalTimelineProps> = () => {
  // Initialize from sessionStorage if available
  const [currentYear, setCurrentYear] = useState<string>(() => {
    return sessionStorage.getItem('timelineYear') || "";
  });
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    return sessionStorage.getItem('timelineMonth') || "";
  });
  const [currentDay, setCurrentDay] = useState<string>(() => {
    return sessionStorage.getItem('timelineDay') || "";
  });
  const [timelineData, setTimelineData] = useState<TimelineData>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch voyages with React Query (with higher limit for timeline view, but cached)
  const { data: voyages = [], isLoading: isLoadingVoyages } = useQuery({
    queryKey: ['timeline-voyages'],
    queryFn: async () => {
      const data = await api.listVoyages(new URLSearchParams({ limit: '1000' }));
      return Array.isArray(data) ? data : [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - timeline data doesn't change often
  });

  // Fetch media with React Query
  const { data: allMedia = [], isLoading: isLoadingMedia } = useQuery({
    queryKey: ['timeline-media'],
    queryFn: async () => {
      return await api.listMedia(new URLSearchParams({ limit: '500' }));
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const isLoadingTimeline = isLoadingVoyages || isLoadingMedia;

  // President filter state
  const [presidents, setPresidents] = useState<President[]>([]);
  const [selectedPresidents, setSelectedPresidents] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('timelinePresidentFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [pendingPresidents, setPendingPresidents] = useState<string[]>([]);
  const [appliedPresidents, setAppliedPresidents] = useState<string[]>([]);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);


  // Load presidents and initialize filter
  useEffect(() => {
    api.listPresidents().then(pres => {
      setPresidents(pres);
      const saved = sessionStorage.getItem('timelinePresidentFilter');
      if (!saved) {
        const allSlugs = pres.map(p => p.president_slug);
        setSelectedPresidents(allSlugs);
        setAppliedPresidents(allSlugs);
        setPendingPresidents(allSlugs);
      } else {
        const savedSlugs = JSON.parse(saved);
        setAppliedPresidents(savedSlugs);
        setPendingPresidents(savedSlugs);
      }
    }).catch(() => setPresidents([]));
  }, []);

  // Filter voyages by selected presidents only
  const filteredVoyages = useMemo(() => {
    return voyages.filter(voyage => {
      if (!voyage.start_date) return false;

      // Filter by president
      if (appliedPresidents.length > 0) {
        const voyagePresident = voyage.president_slug_from_voyage;
        if (!voyagePresident || !appliedPresidents.includes(voyagePresident)) {
          return false;
        }
      }

      return true;
    });
  }, [voyages, appliedPresidents]);

  // Save applied filter to sessionStorage
  useEffect(() => {
    if (appliedPresidents.length > 0) {
      sessionStorage.setItem('timelinePresidentFilter', JSON.stringify(appliedPresidents));
    }
  }, [appliedPresidents]);

  // Close president dropdown when clicking outside
  useEffect(() => {
    if (!filterDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [filterDropdownOpen]);

  // Organize voyages and media by year/month/day
  useEffect(() => {
    if (isLoadingTimeline) return; // Wait for data to load

    const organized: TimelineData = {};

    // Add voyages to timeline
    filteredVoyages.forEach(voyage => {
      if (!voyage.start_date) return;

      const date = dayjs(voyage.start_date);
      const year = date.format('YYYY');
      const month = date.format('MMMM');
      const day = date.format('D');

      if (!organized[year]) organized[year] = {};
      if (!organized[year][month]) organized[year][month] = {};
      if (!organized[year][month][day]) organized[year][month][day] = { voyages: [], media: [] };

      organized[year][month][day].voyages.push(voyage);
    });

    // Add media to timeline
    allMedia.forEach(media => {
      if (!media.date) return;

      const mediaDate = dayjs(media.date);
      const year = mediaDate.format('YYYY');
      const month = mediaDate.format('MMMM');
      const day = mediaDate.format('D');

      // Include media with valid URLs (s3, drive, dropbox)
      const url = media.s3_url || media.url || media.public_derivative_url || '';
      if (!url) return; // Skip media without any URL

      if (!organized[year]) organized[year] = {};
      if (!organized[year][month]) organized[year][month] = {};
      if (!organized[year][month][day]) organized[year][month][day] = { voyages: [], media: [] };

      organized[year][month][day].media.push(media);
    });

    setTimelineData(organized);

    // Set initial year, month, and day - prefer saved position, fallback to first available
    const years = Object.keys(organized).sort();
    if (years.length > 0) {
      // Check if saved position is valid
      const savedYear = currentYear;
      const savedMonth = currentMonth;
      const savedDay = currentDay;

      const isValidSavedPosition = savedYear &&
        organized[savedYear] &&
        savedMonth &&
        organized[savedYear][savedMonth] &&
        savedDay &&
        organized[savedYear][savedMonth][savedDay];

      if (!isValidSavedPosition && !currentYear) {
        // No valid saved position, use first available
        const firstYear = years[0];
        setCurrentYear(firstYear);

        const months = Object.keys(organized[firstYear]).sort((a, b) =>
          dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
        );
        if (months.length > 0) {
          const firstMonth = months[0];
          setCurrentMonth(firstMonth);

          const days = Object.keys(organized[firstYear][firstMonth]).sort((a, b) => parseInt(a) - parseInt(b));
          if (days.length > 0) {
            setCurrentDay(days[0]);
          }
        }
      }
    }
  }, [filteredVoyages, allMedia, isLoadingTimeline]);

  // Save timeline position whenever it changes
  useEffect(() => {
    if (currentYear) sessionStorage.setItem('timelineYear', currentYear);
  }, [currentYear]);

  useEffect(() => {
    if (currentMonth) sessionStorage.setItem('timelineMonth', currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    if (currentDay) sessionStorage.setItem('timelineDay', currentDay);
  }, [currentDay]);

  // No longer needed - we only show media organized by its own date field

  const years = Object.keys(timelineData).sort();
  const months = (currentYear && timelineData[currentYear]) ? Object.keys(timelineData[currentYear]).sort((a, b) =>
    dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
  ) : [];

  const currentMonthData = timelineData[currentYear]?.[currentMonth] || {};
  const days = Object.keys(currentMonthData).sort((a, b) => parseInt(a) - parseInt(b));

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentMonthIndex = months.indexOf(currentMonth);

    if (direction === 'next') {
      if (currentMonthIndex < months.length - 1) {
        setCurrentMonth(months[currentMonthIndex + 1]);
      } else {
        // Move to next year
        const currentYearIndex = years.indexOf(currentYear);
        if (currentYearIndex < years.length - 1) {
          const nextYear = years[currentYearIndex + 1];
          setCurrentYear(nextYear);
          const nextYearMonths = Object.keys(timelineData[nextYear]).sort((a, b) =>
            dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
          );
          setCurrentMonth(nextYearMonths[0] || '');
        }
      }
    } else {
      if (currentMonthIndex > 0) {
        setCurrentMonth(months[currentMonthIndex - 1]);
      } else {
        // Move to previous year
        const currentYearIndex = years.indexOf(currentYear);
        if (currentYearIndex > 0) {
          const prevYear = years[currentYearIndex - 1];
          setCurrentYear(prevYear);
          const prevYearMonths = Object.keys(timelineData[prevYear]).sort((a, b) =>
            dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
          );
          setCurrentMonth(prevYearMonths[prevYearMonths.length - 1] || '');
        }
      }
    }
  };

  // Navigate to next/previous day with any events (voyages or media)
  const navigateDay = (direction: 'prev' | 'next') => {
    // Build chronological list of all dates
    const allDates: Array<{ year: string; month: string; day: string; date: dayjs.Dayjs }> = [];

    years.forEach(year => {
      const yearMonths = Object.keys(timelineData[year]).sort((a, b) =>
        dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
      );

      yearMonths.forEach(month => {
        const monthDays = Object.keys(timelineData[year][month]).sort((a, b) => parseInt(a) - parseInt(b));

        monthDays.forEach(day => {
          allDates.push({
            year,
            month,
            day,
            date: dayjs(`${year}-${dayjs().month(dayjs(`${month} 1`).month()).format('MM')}-${day.padStart(2, '0')}`)
          });
        });
      });
    });

    // Sort by actual date
    allDates.sort((a, b) => a.date.valueOf() - b.date.valueOf());

    // Find current position by matching year, month, AND day
    const currentIndex = allDates.findIndex(d =>
      d.year === currentYear && d.month === currentMonth && d.day === currentDay
    );

    if (currentIndex === -1) return;

    // Navigate to next or previous date
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (targetIndex >= 0 && targetIndex < allDates.length) {
      const target = allDates[targetIndex];
      setCurrentYear(target.year);
      setCurrentMonth(target.month);
      setCurrentDay(target.day);
    }
  };

  // Navigate to next/previous voyage
  const navigateVoyage = (direction: 'prev' | 'next') => {
    // Get filtered voyages sorted by date (respect date range filters)
    const sortedVoyages = [...filteredVoyages]
      .filter(v => v.start_date)
      .sort((a, b) => dayjs(a.start_date).valueOf() - dayjs(b.start_date).valueOf());

    if (sortedVoyages.length === 0) return;

    // Find current position based on current date
    const currentDate = dayjs(`${currentYear}-${dayjs().month(dayjs(`${currentMonth} 1`).month()).format('MM')}-${currentDay.padStart(2, '0')}`);

    // Find the voyage closest to current date
    let currentVoyageIndex = -1;

    // First try to find a voyage on the exact current date
    currentVoyageIndex = sortedVoyages.findIndex(v =>
      dayjs(v.start_date).isSame(currentDate, 'day')
    );

    if (currentVoyageIndex === -1) {
      // No voyage on current date, find nearest depending on direction
      if (direction === 'next') {
        // Find first voyage after current date
        currentVoyageIndex = sortedVoyages.findIndex(v => dayjs(v.start_date).isAfter(currentDate, 'day'));
        if (currentVoyageIndex === -1) return; // No more voyages
        currentVoyageIndex--; // Step back so we increment to the found one
      } else {
        // Find last voyage before current date
        for (let i = sortedVoyages.length - 1; i >= 0; i--) {
          if (dayjs(sortedVoyages[i].start_date).isBefore(currentDate, 'day')) {
            currentVoyageIndex = i + 1; // Step forward so we decrement to the found one
            break;
          }
        }
        if (currentVoyageIndex === -1) return; // No earlier voyages
      }
    }

    // Navigate to next or previous
    const targetIndex = direction === 'next' ? currentVoyageIndex + 1 : currentVoyageIndex - 1;

    if (targetIndex < 0 || targetIndex >= sortedVoyages.length) return;

    const targetVoyage = sortedVoyages[targetIndex];
    const voyageDate = dayjs(targetVoyage.start_date);

    setCurrentYear(voyageDate.format('YYYY'));
    setCurrentMonth(voyageDate.format('MMMM'));
    setCurrentDay(voyageDate.format('D'));
  };

  // Navigate to next/previous media
  const navigateMedia = (direction: 'prev' | 'next') => {
    // Build chronological list of all dates with media
    const mediaDates: Array<{ year: string; month: string; day: string; date: dayjs.Dayjs }> = [];

    console.log('navigateMedia called, direction:', direction);
    console.log('Timeline data:', timelineData);

    years.forEach(year => {
      const yearMonths = Object.keys(timelineData[year]).sort((a, b) =>
        dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
      );

      yearMonths.forEach(month => {
        const monthDays = Object.keys(timelineData[year][month]).sort((a, b) => parseInt(a) - parseInt(b));

        monthDays.forEach(day => {
          const dayData = timelineData[year][month][day];
          // Only include days that have media
          if (dayData.media && dayData.media.length > 0) {
            mediaDates.push({
              year,
              month,
              day,
              date: dayjs(`${year}-${dayjs().month(dayjs(`${month} 1`).month()).format('MM')}-${day.padStart(2, '0')}`)
            });
          }
        });
      });
    });

    // Sort by actual date
    mediaDates.sort((a, b) => a.date.valueOf() - b.date.valueOf());

    console.log('Found media dates:', mediaDates.length);
    console.log('Media dates:', mediaDates);

    // Find current position
    const currentIndex = mediaDates.findIndex(d =>
      d.year === currentYear && d.month === currentMonth && d.day === currentDay
    );

    console.log('Current index:', currentIndex, 'Current date:', {currentYear, currentMonth, currentDay});

    if (currentIndex === -1 && mediaDates.length > 0) {
      // Not on a media date, find nearest
      const currentDate = dayjs(`${currentYear}-${dayjs().month(dayjs(`${currentMonth} 1`).month()).format('MM')}-${currentDay.padStart(2, '0')}`);

      if (direction === 'next') {
        const nextMediaIndex = mediaDates.findIndex(d => d.date.isAfter(currentDate));
        if (nextMediaIndex !== -1) {
          const target = mediaDates[nextMediaIndex];
          setCurrentYear(target.year);
          setCurrentMonth(target.month);
          setCurrentDay(target.day);
        }
      } else {
        for (let i = mediaDates.length - 1; i >= 0; i--) {
          if (mediaDates[i].date.isBefore(currentDate)) {
            const target = mediaDates[i];
            setCurrentYear(target.year);
            setCurrentMonth(target.month);
            setCurrentDay(target.day);
            break;
          }
        }
      }
      return;
    }

    // Navigate to next or previous media date
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (targetIndex >= 0 && targetIndex < mediaDates.length) {
      const target = mediaDates[targetIndex];
      setCurrentYear(target.year);
      setCurrentMonth(target.month);
      setCurrentDay(target.day);
    }
  };

  if (isLoadingVoyages || isLoadingTimeline) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-gray-600">Loading timeline...</p>
      </div>
    );
  }

  if (!currentYear || !currentMonth || !currentDay) {
    return <div className="text-center py-8 text-gray-500">No timeline data available</div>;
  }

  const handleMediaClick = (media: MediaItem) => {
    // Prefer high-quality original (s3_url) over thumbnail (public_derivative_url)
    // Convert s3:// to HTTPS for browser viewing
    let url = '';
    if (media.s3_url) {
      url = media.s3_url.replace(/^s3:\/\/([^/]+)\//, 'https://$1.s3.amazonaws.com/');
    } else {
      url = media.url || media.public_derivative_url || '';
    }

    // Open all media in lightbox (not just images)
    if (url) {
      setLightboxSrc(url);
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-200 to-gray-300 p-6 rounded-lg shadow-lg" style={{
      background: 'linear-gradient(135deg, #d1d5db 0%, #e5e7eb 50%, #d1d5db 100%)'
    }}>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-red-700" style={{ fontFamily: 'serif' }}>timeline</h2>
      </div>

      {/* President Filter - Integrated into Timeline */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div ref={filterDropdownRef} className="relative">
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="px-3 py-2 text-sm border-2 border-gray-400 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 shadow-md hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-gray-700">
              {pendingPresidents.length === 0
                ? 'No Presidents'
                : pendingPresidents.length === presidents.length
                ? 'All Presidents'
                : `${pendingPresidents.length} President${pendingPresidents.length !== 1 ? 's' : ''}`}
            </span>
            <span className="text-gray-500">▾</span>
          </button>

          {filterDropdownOpen && (
            <div className="absolute z-20 mt-1 w-64 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900">Filter Presidents</span>
                <button
                  onClick={() => setPendingPresidents(presidents.map(p => p.president_slug))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select All
                </button>
              </div>
              <div className="p-2">
                {presidents.map(president => {
                  const isSelected = pendingPresidents.includes(president.president_slug);
                  return (
                    <label
                      key={president.president_slug}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPendingPresidents([...pendingPresidents, president.president_slug]);
                          } else {
                            // Prevent deselecting the last president
                            if (pendingPresidents.length <= 1) {
                              alert('Must select at least 1 President/Owner');
                              return;
                            }
                            setPendingPresidents(pendingPresidents.filter(s => s !== president.president_slug));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {president.full_name}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="p-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setAppliedPresidents(pendingPresidents);
                    setSelectedPresidents(pendingPresidents);
                    setFilterDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          )}
        </div>

        {appliedPresidents.length !== presidents.length && (
          <button
            onClick={() => {
              const allSlugs = presidents.map(p => p.president_slug);
              setPendingPresidents(allSlugs);
              setAppliedPresidents(allSlugs);
              setSelectedPresidents(allSlugs);
            }}
            className="px-3 py-2 text-sm bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-md"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Current Date Display */}
      <div className="mb-4 text-center bg-gray-200 px-8 py-4 border-2 border-gray-500 shadow-md" style={{
        background: 'linear-gradient(to bottom, #f3f4f6 0%, #e5e7eb 100%)'
      }}>
        <div className="text-3xl font-light text-gray-800 tracking-wide">
          {dayjs(`${currentYear}-${dayjs().month(dayjs(`${currentMonth} 1`).month()).format('MM')}-${currentDay.padStart(2, '0')}`).format('MMMM D, YYYY')}
        </div>
      </div>

      {/* Main Timeline Content */}
      <div className="bg-white border-2 border-gray-500 shadow-lg overflow-hidden" style={{
        borderStyle: 'solid',
        borderColor: '#666'
      }}>
        {/* Events Row */}
        <div className="border-b-2 border-gray-500">
          <div>
            {currentMonthData[currentDay] && (() => {
              const dayData = currentMonthData[currentDay];
              const hasVoyages = dayData.voyages.length > 0;

              return (
                <div className={`min-h-40 p-4 ${hasVoyages ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  {hasVoyages && (
                    <div className="space-y-3">
                      {dayData.voyages.map(voyage => (
                        <Link
                          key={voyage.voyage_slug}
                          to={`/voyages/${voyage.voyage_slug}`}
                          className="block"
                        >
                          <div className="bg-white border border-orange-300 rounded-md p-3 hover:bg-orange-100 transition-colors shadow-sm">
                            <div className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                              {voyage.title || `Voyage ${dayjs(voyage.start_date).format('MMM D, YYYY')}`}
                            </div>
                            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                              <div>
                                <strong>Start:</strong> {voyage.start_timestamp ? dayjs(voyage.start_timestamp).format('MMM D, YYYY [at] h:mm A') : dayjs(voyage.start_date).format('MMM D, YYYY')}
                                {(voyage.start_location || voyage.origin) && (
                                  <span className="ml-1">📍 {voyage.start_location || voyage.origin}</span>
                                )}
                              </div>
                              <div>
                                <strong>End:</strong> {voyage.end_timestamp ? dayjs(voyage.end_timestamp).format('MMM D, YYYY [at] h:mm A') : (voyage.end_date ? dayjs(voyage.end_date).format('MMM D, YYYY') : '—')}
                                {(voyage.end_location || voyage.destination) && (
                                  <span className="ml-1">📍 {voyage.end_location || voyage.destination}</span>
                                )}
                              </div>
                            </div>
                            {(voyage.additional_information || voyage.summary_markdown) && (
                              <div className="text-xs text-gray-700 mt-2 line-clamp-2">
                                {voyage.additional_information || voyage.summary_markdown}
                              </div>
                            )}
                            {voyage.notes_internal && (
                              <div className="text-xs text-gray-500 italic mt-1 line-clamp-1">
                                Notes: {voyage.notes_internal}
                              </div>
                            )}
                          </div>
                          <button className="text-xs bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded mt-2 font-bold uppercase tracking-wide">
                            Click to see voyage details and all associated media and sources
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Media Row */}
        <div>
          <div>
            {currentMonthData[currentDay] && (() => {
              const dayData = currentMonthData[currentDay];
              // Only show media organized by its own date field (not voyage date)
              const dayMedia = dayData.media || [];

              return (
                <div className="min-h-36 p-4 bg-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-gray-700">{currentDay}</span>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                      {dayjs(`${currentYear}-${dayjs().month(dayjs(`${currentMonth} 1`).month()).format('MM')}-${currentDay.padStart(2, '0')}`).format('MMMM D, YYYY')}
                    </div>
                  </div>

                  {dayMedia.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {dayMedia.map(media => {
                        const url = media.url || media.public_derivative_url || media.s3_url || '';
                        const thumbnailUrl = media.public_derivative_url || media.url;
                        const isImage = looksLikeImage(url);
                        const isVideo = looksLikeVideo(url);
                        const hasImage = thumbnailUrl && (isImage || media.media_type?.toLowerCase() === 'photo');

                        return (
                          <button
                            key={media.media_slug}
                            onClick={() => handleMediaClick(media)}
                            className="bg-white rounded border border-gray-300 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer text-left"
                            title={media.title || 'Click to view'}
                          >
                            {hasImage && thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={media.title || 'Voyage media'}
                                className="w-full h-20 object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Prevent repeated error handling
                                  const img = e.currentTarget;
                                  if (img.dataset.errorHandled === 'true') return;
                                  img.dataset.errorHandled = 'true';

                                  // Hide image on error and show fallback based on media type
                                  img.style.display = 'none';
                                  const parent = img.parentElement;
                                  if (parent && !parent.querySelector('.error-fallback')) {
                                    const fallback = document.createElement('div');
                                    fallback.classList.add('error-fallback');
                                    const type = media.media_type?.toLowerCase();
                                    if (type === 'pdf') {
                                      fallback.className = 'error-fallback w-full h-20 bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center text-red-600 text-xs font-medium';
                                      fallback.innerHTML = '<div class="text-2xl mb-1">📄</div><div>PDF Document</div>';
                                    } else if (type === 'video') {
                                      fallback.className = 'error-fallback w-full h-20 bg-gray-800 flex flex-col items-center justify-center text-white text-xs font-medium';
                                      fallback.innerHTML = '<div class="text-2xl mb-1">▶️</div><div>Video</div>';
                                    } else if (type === 'audio') {
                                      fallback.className = 'error-fallback w-full h-20 bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-center text-blue-600 text-xs font-medium';
                                      fallback.innerHTML = '<div class="text-2xl mb-1">🔊</div><div>Audio</div>';
                                    } else {
                                      fallback.className = 'error-fallback w-full h-20 bg-gray-100 border-2 border-gray-300 flex flex-col items-center justify-center text-gray-600 text-xs font-medium';
                                      fallback.innerHTML = '<div class="text-2xl mb-1">📎</div><div>Document</div>';
                                    }
                                    parent.insertBefore(fallback, parent.firstChild);
                                  }
                                }}
                              />
                            ) : isVideo ? (
                              <div className="w-full h-20 bg-gray-800 flex flex-col items-center justify-center text-white">
                                <div className="text-2xl mb-1">▶️</div>
                                <div className="text-xs font-medium">Video</div>
                              </div>
                            ) : media.media_type?.toLowerCase() === 'pdf' ? (
                              <div className="w-full h-20 bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center text-red-600">
                                <div className="text-2xl mb-1">📄</div>
                                <div className="text-xs font-medium">PDF Document</div>
                              </div>
                            ) : media.media_type?.toLowerCase() === 'audio' ? (
                              <div className="w-full h-20 bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-center text-blue-600">
                                <div className="text-2xl mb-1">🔊</div>
                                <div className="text-xs font-medium">Audio</div>
                              </div>
                            ) : (
                              <div className="w-full h-20 bg-gray-100 border-2 border-gray-300 flex flex-col items-center justify-center text-gray-600">
                                <div className="text-2xl mb-1">📎</div>
                                <div className="text-xs font-medium">Document</div>
                              </div>
                            )}
                            <div className="p-1.5">
                              <div className="text-xs text-gray-700 line-clamp-2">
                                {[media.title, media.credit, media.date].filter(Boolean).join(' • ') || 'View media'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 text-sm italic">
                      No media available
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Navigation Arrows - Voyages */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => navigateVoyage('prev')}
          className="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold text-lg border border-gray-600 shadow-md transition-colors"
          title="Skip to Previous Voyage"
        >
          ← Previous Voyage
        </button>

        <button
          onClick={() => navigateVoyage('next')}
          className="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold text-lg border border-gray-600 shadow-md transition-colors"
          title="Skip to Next Voyage"
        >
          Next Voyage →
        </button>
      </div>

      {/* Navigation Arrows - Media */}
      <div className="flex justify-between mt-3">
        <button
          onClick={() => navigateMedia('prev')}
          className="px-6 py-3 bg-blue-400 hover:bg-blue-500 text-white font-bold text-lg border border-blue-600 shadow-md transition-colors"
          title="Skip to Previous Media"
        >
          ← Previous Media
        </button>

        <button
          onClick={() => navigateMedia('next')}
          className="px-6 py-3 bg-blue-400 hover:bg-blue-500 text-white font-bold text-lg border border-blue-600 shadow-md transition-colors"
          title="Skip to Next Media"
        >
          Next Media →
        </button>
      </div>

      {/* Lightbox for images */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-8 h-8 shadow hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
            <a
              href={lightboxSrc}
              download
              className="absolute -top-3 -right-14 bg-blue-600 text-white rounded-md px-3 py-1.5 shadow hover:bg-blue-700 transition-colors text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
            {lightboxSrc.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={lightboxSrc}
                className="w-full h-[85vh] rounded-lg bg-white"
                title="PDF Viewer"
              />
            ) : lightboxSrc.match(/\.(mp4|mov|avi|webm)$/i) ? (
              <video
                src={lightboxSrc}
                controls
                className="w-full max-h-[85vh] rounded-lg bg-black"
                autoPlay
              />
            ) : (
              <img
                src={lightboxSrc}
                alt="Media"
                className="w-full max-h-[85vh] object-contain rounded-lg bg-white"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalTimeline;