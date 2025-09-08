import React, { useState, useEffect } from 'react';
import Layout from './Layout';

const CuratorPage: React.FC = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    // In a real implementation, this would fetch from your backend
    // For now, we'll simulate loading the input.md content
    const loadContent = async () => {
      try {
        // This would be replaced with actual API call to fetch input.md
        setContent(`# USS Sequoia Voyage Records

## Current Processing Status
- **Total Voyages Processed**: 86
- **Status**: In Progress
- **Last Updated**: ${new Date().toLocaleDateString()}

## Recent Additions

### 2024-12-15
**Voyage**: Presidential Trip to Camp David
**Date**: 1995-06-15
**Passengers**:
- President Bill Clinton
- Hillary Rodham Clinton
- Secret Service Detail

**Notes**: 
- Clear weather conditions
- Duration: 4 hours
- Route: Washington Naval Yard to Potomac River anchorage

---

### 2024-12-14
**Voyage**: State Dinner Guests Transportation  
**Date**: 1994-11-23
**Passengers**:
- Foreign dignitaries (TBD - verify manifest)
- State Department officials
- White House staff

**Media**:
- Photo series: State dinner preparation
- Video: Boarding procedures
- Documents: Guest list (classified)

---

## Processing Notes

### Data Quality Issues
- [ ] Verify passenger spellings in 1980s records
- [ ] Cross-reference media files with voyage dates
- [ ] Complete missing voyage summaries
- [ ] Update classification levels

### Media Organization
- Images: 1,247 processed, 89 pending review
- Documents: 456 processed, 23 pending classification
- Video: 67 processed, 12 pending digitization

### Next Steps
1. Complete passenger manifest verification
2. Process remaining media files
3. Update voyage summaries
4. Prepare for public release review

## Quick Reference

**Common Passenger Categories**:
- POTUS (President of the United States)
- FLOTUS (First Lady of the United States)  
- VPOTUS (Vice President)
- Cabinet Members
- Foreign Dignitaries
- Press Corps
- Secret Service
- White House Staff
- Naval Personnel

**Media Types**:
- Official Photography
- Casual Photography
- Motion Pictures
- Audio Recordings
- Official Documents
- Personal Correspondence
- Navigation Logs
- Guest Registers

---

*This document is maintained by the USS Sequoia Archive curatorial team.*`);
      } catch (error) {
        console.error('Failed to load content:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real implementation, this would save to your backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save content:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading curatorial workspace...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              For Curators
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Edit and manage the curatorial input document for voyage processing
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-b-2 border-white rounded-full"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Last Saved Indicator */}
        {lastSaved && (
          <div className="mb-4 text-sm text-gray-500">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}

        {/* Editor */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="p-1">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
              input.md
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-screen max-h-[800px] p-6 font-mono text-sm text-gray-900 bg-white border-0 resize-none focus:ring-0 focus:outline-none"
              placeholder="Enter curatorial notes and processing information..."
              style={{
                lineHeight: '1.5',
                tabSize: 2,
              }}
            />
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-4 text-sm text-gray-500">
          <p>
            <strong>Tip:</strong> Use Ctrl+S to save your changes quickly. This document supports Markdown formatting 
            and is used to track voyage processing status, data quality issues, and curatorial notes.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default CuratorPage;