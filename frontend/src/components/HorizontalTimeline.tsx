import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
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

interface HorizontalTimelineProps {
  voyages: Voyage[];
}

const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ voyages }) => {
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
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);

  // Timeline-specific filters (separate from list view)
  const [selectedPresident, setSelectedPresident] = useState<string>(() => {
    return sessionStorage.getItem('timelinePresidentFilter') || "";
  });
  const [startDateFilter, setStartDateFilter] = useState<string>(() => {
    return sessionStorage.getItem('timelineStartDate') || "";
  });
  const [endDateFilter, setEndDateFilter] = useState<string>(() => {
    return sessionStorage.getItem('timelineEndDate') || "";
  });
  const [presidents, setPresidents] = useState<President[]>([]);

  // Load presidents
  useEffect(() => {
    api.listPresidents().then(setPresidents).catch(() => setPresidents([]));
  }, []);

  // Filter voyages by president and date range (memoized to prevent infinite loops)
  const filteredVoyages = useMemo(() => {
    return voyages.filter(voyage => {
      // President filter
      if (selectedPresident && voyage.president_slug_from_voyage !== selectedPresident) {
        return false;
      }

      // Date range filters
      if (startDateFilter && voyage.start_date) {
        if (dayjs(voyage.start_date).isBefore(dayjs(startDateFilter), 'day')) {
          return false;
        }
      }
      if (endDateFilter && voyage.start_date) {
        if (dayjs(voyage.start_date).isAfter(dayjs(endDateFilter), 'day')) {
          return false;
        }
      }

      return true;
    });
  }, [voyages, selectedPresident, startDateFilter, endDateFilter]);

  // Save filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('timelinePresidentFilter', selectedPresident);
  }, [selectedPresident]);

  useEffect(() => {
    sessionStorage.setItem('timelineStartDate', startDateFilter);
  }, [startDateFilter]);

  useEffect(() => {
    sessionStorage.setItem('timelineEndDate', endDateFilter);
  }, [endDateFilter]);

  // Organize voyages by year/month/day
  useEffect(() => {
    setIsLoadingTimeline(true);
    const organized: TimelineData = {};

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

    // Fetch all media with dates and add to timeline
    api.listMedia(new URLSearchParams({ limit: '500' })).then(allMedia => {
      allMedia.forEach(media => {
        if (!media.date) return;

        const date = dayjs(media.date);
        const year = date.format('YYYY');
        const month = date.format('MMMM');
        const day = date.format('D');

        // Include media with valid URLs (s3, drive, dropbox)
        const url = media.s3_url || media.url || media.public_derivative_url || '';
        if (!url) return; // Skip media without any URL

        if (!organized[year]) organized[year] = {};
        if (!organized[year][month]) organized[year][month] = {};
        if (!organized[year][month][day]) organized[year][month][day] = { voyages: [], media: [] };

        organized[year][month][day].media.push(media);
      });

      setTimelineData(organized);
      setIsLoadingTimeline(false);

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
    }).catch(err => {
      console.error('Failed to fetch media for timeline:', err);
      setTimelineData(organized);
      setIsLoadingTimeline(false);

      // Set initial year, month, and day even if media fetch fails
      const years = Object.keys(organized).sort();
      if (years.length > 0) {
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
    });
  }, [filteredVoyages]);

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
    // Get ALL voyages sorted by date (unfiltered - navigate through entire timeline)
    const sortedVoyages = [...voyages]
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

  if (isLoadingTimeline) {
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
    const url = media.s3_url || media.url || media.public_derivative_url || '';
    if (looksLikeImage(url)) {
      setLightboxSrc(url);
    } else if (looksLikeVideo(url) || url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-200 to-gray-300 p-6 rounded-lg shadow-lg" style={{
      background: 'linear-gradient(135deg, #d1d5db 0%, #e5e7eb 50%, #d1d5db 100%)'
    }}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-red-700" style={{ fontFamily: 'serif' }}>timeline</h2>
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
            <img
              src={lightboxSrc}
              alt="Media"
              className="w-full max-h-[85vh] object-contain rounded-lg bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalTimeline;