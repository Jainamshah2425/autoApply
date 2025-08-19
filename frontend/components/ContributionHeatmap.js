'use client';
import React, { useState, useEffect } from 'react';

const ContributionHeatmap = ({ data = [], timeRange = 'year', detailed = false }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [processedData, setProcessedData] = useState([]);
  const [stats, setStats] = useState({
    totalContributions: 0,
    longestStreak: 0,
    currentStreak: 0,
    contributionTypes: {}
  });

  useEffect(() => {
    processContributionData();
  }, [data, timeRange]);

  const processContributionData = () => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '3months':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case 'year':
      default:
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Generate all dates in the range
    const dateMap = new Map();
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateMap.set(dateStr, {
        date: dateStr,
        count: 0,
        activities: []
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process contribution data
    let totalContributions = 0;
    const contributionTypes = {};

    data.forEach(item => {
      if (!item || !item.date) return;
      const dateStr = item.date;
      if (dateMap.has(dateStr)) {
        const dayData = dateMap.get(dateStr);
        const inc = typeof item.count === 'number' ? item.count : 1;
        dayData.count += inc;
        const acts = Array.isArray(item.activities) ? item.activities : [];
        dayData.activities = [...(dayData.activities || []), ...acts];
        
        totalContributions += inc;
        
        // Count contribution types
        acts.forEach(activity => {
          if (!activity || !activity.type) return;
          contributionTypes[activity.type] = (contributionTypes[activity.type] || 0) + 1;
        });
      }
    });

    // Calculate streaks
    const sortedDates = Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Calculate current streak (from today backwards)
    const today = new Date().toISOString().split('T')[0];
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const day = sortedDates[i];
      if (day.date <= today && day.count > 0) {
        currentStreak++;
      } else if (day.date <= today) {
        break;
      }
    }

    // Calculate longest streak
    sortedDates.forEach(day => {
      if (day.count > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    setProcessedData(Array.from(dateMap.values()));
    setStats({
      totalContributions,
      longestStreak,
      currentStreak,
      contributionTypes
    });
  };

  const getIntensityColor = (count) => {
    if (count === 0) return 'bg-gray-100 border-gray-200';
    if (count <= 2) return 'bg-green-200 border-green-300';
    if (count <= 5) return 'bg-green-300 border-green-400';
    if (count <= 10) return 'bg-green-400 border-green-500';
    return 'bg-green-500 border-green-600';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getWeeksArray = () => {
    const weeks = [];
    const sortedData = [...processedData].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (let i = 0; i < sortedData.length; i += 7) {
      weeks.push(sortedData.slice(i, i + 7));
    }
    
    return weeks;
  };

  const handleMouseEnter = (day, event) => {
    setHoveredCell(day);
    const rect = event.target.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  const weeks = getWeeksArray();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-white rounded-lg p-6">
      {detailed && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Activity Heatmap</h2>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalContributions}</div>
          <div className="text-sm text-gray-600">Total Contributions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.currentStreak}</div>
          <div className="text-sm text-gray-600">Current Streak</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.longestStreak}</div>
          <div className="text-sm text-gray-600">Longest Streak</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Object.keys(stats.contributionTypes).length}
          </div>
          <div className="text-sm text-gray-600">Activity Types</div>
        </div>
      </div>

      {/* Contribution Types Breakdown */}
      {detailed && Object.keys(stats.contributionTypes).length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.contributionTypes).map(([type, count]) => (
              <div key={type} className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-semibold text-gray-900">{count}</div>
                <div className="text-sm text-gray-600 capitalize">
                  {type.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-2">
            <div className="w-12"></div> {/* Space for day labels */}
            {weeks.map((week, weekIndex) => {
              const firstDay = week[0];
              if (firstDay && new Date(firstDay.date).getDate() <= 7) {
                const monthIndex = new Date(firstDay.date).getMonth();
                return (
                  <div key={weekIndex} className="text-xs text-gray-600 text-center" style={{ width: '12px', marginRight: '2px' }}>
                    {weekIndex === 0 || new Date(firstDay.date).getDate() <= 7 ? monthNames[monthIndex] : ''}
                  </div>
                );
              }
              return <div key={weekIndex} style={{ width: '12px', marginRight: '2px' }}></div>;
            })}
          </div>

          {/* Day labels and heatmap grid */}
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col mr-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <div key={day} className="text-xs text-gray-600 h-3 flex items-center mb-0.5" style={{ width: '44px' }}>
                  {index % 2 === 1 ? day : ''}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col mr-0.5">
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const day = week[dayIndex];
                    if (!day) {
                      return (
                        <div
                          key={dayIndex}
                          className="w-3 h-3 mb-0.5 bg-transparent"
                        ></div>
                      );
                    }

                    return (
                      <div
                        key={day.date}
                        className={`w-3 h-3 mb-0.5 border rounded-sm cursor-pointer transition-all duration-200 hover:scale-110 ${getIntensityColor(day.count)}`}
                        onMouseEnter={(e) => handleMouseEnter(day, e)}
                        onMouseLeave={handleMouseLeave}
                        title={`${formatDate(day.date)}: ${day.count} contributions`}
                      ></div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              {timeRange === 'year' ? 'Past year' : 
               timeRange === '6months' ? 'Past 6 months' : 
               'Past 3 months'}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600">Less</span>
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-300 border border-green-400 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-400 border border-green-500 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-500 border border-green-600 rounded-sm"></div>
              </div>
              <span className="text-xs text-gray-600">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y
          }}
        >
          <div className="font-semibold">{formatDate(hoveredCell.date)}</div>
          <div>{hoveredCell.count} contributions</div>
          {hoveredCell.activities && hoveredCell.activities.length > 0 && (
            <div className="mt-1 text-xs">
              {hoveredCell.activities.slice(0, 3).map((activity, index) => (
                <div key={index} className="opacity-75">
                  • {activity.description}
                </div>
              ))}
              {hoveredCell.activities.length > 3 && (
                <div className="opacity-75">+ {hoveredCell.activities.length - 3} more</div>
              )}
            </div>
          )}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default ContributionHeatmap;
