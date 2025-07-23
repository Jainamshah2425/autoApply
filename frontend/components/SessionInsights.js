import React from 'react';

const SessionInsights = ({ sessionData }) => {
  if (!sessionData) {
    return <div className="p-4 bg-white rounded-lg shadow">No session insights available.</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Session Summary</h3>
      <div className="space-y-3">
        <p className="text-gray-700"><strong>Overall Score:</strong> {sessionData.overallScore || 'N/A'}</p>
        <p className="text-gray-700"><strong>Strengths:</strong> {sessionData.strengths || 'N/A'}</p>
        <p className="text-gray-700"><strong>Areas for Improvement:</strong> {sessionData.areasForImprovement || 'N/A'}</p>
        <p className="text-gray-700"><strong>Suggested Resources:</strong> {sessionData.suggestedResources || 'N/A'}</p>
      </div>

      {sessionData.questionAnalysis && sessionData.questionAnalysis.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-3 text-gray-800">Question-by-Question Analysis</h4>
          <div className="space-y-4">
            {sessionData.questionAnalysis.map((qa, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-800">Question: {qa.question}</p>
                <p className="text-sm text-gray-600 mt-1">Your Answer: {qa.answer}</p>
                <p className="text-sm text-gray-600">Feedback: {qa.feedback}</p>
                {qa.score && <p className="text-sm text-gray-600">Score: {qa.score}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionInsights;
