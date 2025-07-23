"use client";
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import React from 'react';

const QuestionAnalytics = ({ data }) => {
  if (!data) {
    return <div className="p-4 bg-white rounded-lg shadow">No analytics data available.</div>;
  }

  return (
    <div className="space-y-4">
      {data.score && (
        <div>
          <h4 className="font-semibold text-gray-700">Score:</h4>
          <p className="text-lg font-bold text-green-700">{data.score}/10</p>
        </div>
      )}

      {data.feedback && (
        <div>
          <h4 className="font-semibold text-gray-700">Feedback:</h4>
          <p className="text-gray-800">{data.feedback}</p>
        </div>
      )}

      {data.suggestions && (
        <div>
          <h4 className="font-semibold text-gray-700">Suggestions for Improvement:</h4>
          <ul className="list-disc list-inside text-gray-800">
            {data.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {data.audioMetrics && (
        <div>
          <h4 className="font-semibold text-gray-700">Audio Metrics:</h4>
          <p className="text-gray-800">Duration: {data.audioMetrics.duration?.toFixed(2)} seconds</p>
          <p className="text-gray-800">Words per Minute: {data.audioMetrics.wordsPerMinute}</p>
          <p className="text-gray-800">Word Count: {data.audioMetrics.wordCount}</p>
        </div>
      )}
    </div>
  );
};

export default QuestionAnalytics;
