import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { Voyage, MediaItem } from "../types";
import { api } from "../api";

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
  const [currentYear, setCurrentYear] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [timelineData, setTimelineData] = useState<TimelineData>({});
  const [mediaData, setMediaData] = useState<{ [voyageSlug: string]: MediaItem[] }>({});

  // Organize voyages by year/month/day
  useEffect(() => {
    const organized: TimelineData = {};
    
    voyages.forEach(voyage => {
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

    setTimelineData(organized);

    // Set initial year and month to first available data
    const years = Object.keys(organized).sort();
    if (years.length > 0 && !currentYear) {
      const firstYear = years[0];
      setCurrentYear(firstYear);
      
      const months = Object.keys(organized[firstYear]).sort((a, b) => 
        dayjs().month(dayjs(`${a} 1`).month()).valueOf() - dayjs().month(dayjs(`${b} 1`).month()).valueOf()
      );
      if (months.length > 0) {
        setCurrentMonth(months[0]);
      }
    }
  }, [voyages, currentYear]);

  // Fetch media for visible voyages
  useEffect(() => {
    const currentMonthData = timelineData[currentYear]?.[currentMonth];
    if (!currentMonthData) return;

    const voyageSlugs = Object.values(currentMonthData)
      .flatMap(dayData => dayData.voyages.map(v => v.voyage_slug));

    Promise.all(
      voyageSlugs.map(slug => 
        api.getVoyageMedia(slug).catch(() => [])
      )
    ).then(results => {
      const mediaMap: { [voyageSlug: string]: MediaItem[] } = {};
      voyageSlugs.forEach((slug, index) => {
        mediaMap[slug] = results[index] || [];
      });
      setMediaData(mediaMap);
    });
  }, [timelineData, currentYear, currentMonth]);

  const years = Object.keys(timelineData).sort();
  const months = currentYear ? Object.keys(timelineData[currentYear]).sort((a, b) => 
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

  if (!currentYear || !currentMonth) {
    return <div className="text-center py-8 text-gray-500">No timeline data available</div>;
  }

  return (
    <div className="bg-gradient-to-b from-gray-200 to-gray-300 p-6 rounded-lg shadow-lg" style={{
      background: 'linear-gradient(135deg, #d1d5db 0%, #e5e7eb 50%, #d1d5db 100%)'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-red-700" style={{ fontFamily: 'serif' }}>timeline</h2>
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">help?</button>
      </div>

      {/* Year Navigation */}
      <div className="flex items-stretch mb-4 shadow-md">
        <button 
          onClick={() => navigateMonth('prev')}
          className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold border-r border-gray-600 transition-colors"
        >
          ←
        </button>
        
        <div className="bg-gray-600 text-white px-6 py-2 font-bold text-base tracking-wide">
          {currentYear.slice(-2)}
        </div>
        
        <div className="bg-gray-200 px-8 py-2 flex-1 text-center border-l-2 border-gray-600" style={{
          background: 'linear-gradient(to bottom, #f3f4f6 0%, #e5e7eb 100%)'
        }}>
          <div className="text-2xl font-light text-gray-700 tracking-widest" style={{ letterSpacing: '3px' }}>
            {currentYear}
          </div>
          <div className="text-xl text-gray-800 mt-1 font-medium">{currentMonth}</div>
        </div>
        
        <button 
          onClick={() => navigateMonth('next')}
          className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold border-l border-gray-600 transition-colors"
        >
          →
        </button>
      </div>

      {/* Main Timeline Content */}
      <div className="bg-white border-2 border-gray-500 shadow-lg overflow-hidden" style={{
        borderStyle: 'solid',
        borderColor: '#666'
      }}>
        {/* Events Row */}
        <div className="border-b-2 border-gray-500">
          <div className="flex">
            {days.map((day, index) => {
              const dayData = currentMonthData[day];
              const hasVoyages = dayData.voyages.length > 0;
              const isLast = index === days.length - 1;
              
              return (
                <div key={day} className={`flex-1 min-h-40 p-4 ${!isLast ? 'border-r border-gray-400' : ''} ${hasVoyages ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  {hasVoyages && (
                    <div className="space-y-3">
                      {dayData.voyages.map(voyage => (
                        <Link
                          key={voyage.voyage_slug}
                          to={`/voyages/${voyage.voyage_slug}`}
                          className="block"
                        >
                          <div className="bg-white border border-orange-300 rounded-md p-3 hover:bg-orange-100 transition-colors shadow-sm">
                            <div className="text-sm text-gray-800 leading-tight mb-2">
                              {dayjs(voyage.start_date).format('MMMM D, YYYY')} - {voyage.title || voyage.summary_markdown?.slice(0, 100) + '...' || 'USS Sequoia Voyage'}
                            </div>
                          </div>
                          <button className="text-xs bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded mt-2 font-bold uppercase tracking-wide">
                            VIEW
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Media Row */}
        <div>
          <div className="flex">
            {days.map((day, index) => {
              const dayData = currentMonthData[day];
              const dayMedia: MediaItem[] = [];
              const isLast = index === days.length - 1;
              
              // Collect media from voyages on this day
              dayData.voyages.forEach(voyage => {
                const voyageMedia = mediaData[voyage.voyage_slug] || [];
                dayMedia.push(...voyageMedia);
              });

              return (
                <div key={`media-${day}`} className={`flex-1 min-h-36 p-4 ${!isLast ? 'border-r border-gray-400' : ''} bg-gray-100`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-gray-700">{day}</span>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                      {index === 0 ? "First" : index === 1 ? "Second" : index + 1}
                    </div>
                  </div>
                  
                  {dayMedia.length > 0 ? (
                    <div className="space-y-2">
                      {dayMedia.slice(0, 2).map(media => (
                        <div key={media.media_slug} className="bg-black text-white rounded-md p-3 shadow-sm">
                          <div className="text-xs font-bold text-gray-200 mb-1">
                            {media.media_type || 'Diaries / Logs'}
                          </div>
                          <div className="text-xs text-white mb-2">
                            {media.title || media.description_markdown?.slice(0, 40) + '...' || 'Historical Document'}
                          </div>
                          <button className="text-xs bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded font-bold uppercase tracking-wide">
                            VIEW
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 text-sm italic">
                      No media available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <div className="flex justify-between mt-6">
        <button 
          onClick={() => navigateMonth('prev')}
          className="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold text-lg border border-gray-600 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={years.indexOf(currentYear) === 0 && months.indexOf(currentMonth) === 0}
        >
          ← Previous
        </button>
        
        <button 
          onClick={() => navigateMonth('next')}
          className="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold text-lg border border-gray-600 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={years.indexOf(currentYear) === years.length - 1 && months.indexOf(currentMonth) === months.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default HorizontalTimeline;