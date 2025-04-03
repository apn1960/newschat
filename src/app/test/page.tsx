'use client';

import { useState } from 'react';
import { testSupabaseSearch, addDocument, addContentFromUrl, deleteDocument } from '../actions';

export default function TestPage() {
  const [query, setQuery] = useState('');
  const [newDocument, setNewDocument] = useState('');
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSearch = async () => {
    const response = await testSupabaseSearch(query);
    if (response.error) {
      setError(response.error);
      setResults([]);
    } else {
      setError('');
      setResults(response.documents || []);
    }
  };

  const handleAddDocument = async () => {
    if (!newDocument.trim()) {
      setError('Please enter some content');
      return;
    }

    const response = await addDocument(newDocument);
    if (response.error) {
      setError(response.error);
    } else {
      setMessage('Document added successfully!');
      setNewDocument('');
      // Refresh search results if there's a current query
      if (query) {
        handleSearch();
      }
    }
  };

  const handleAddUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    const response = await addContentFromUrl(url);
    if (response.error) {
      setError(response.error);
    } else {
      setMessage('URL content added successfully!');
      setUrl('');
      // Refresh search results if there's a current query
      if (query) {
        handleSearch();
      }
    }
  };

  const handleDelete = async (id: number) => {
    const response = await deleteDocument(id);
    if (response.error) {
      setError(response.error);
    } else {
      setMessage('Document deleted successfully!');
      // Refresh search results
      handleSearch();
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Test Supabase Search</h1>
      
      {/* Search Section */}
      <div className="mb-8">
        <h2 className="text-xl mb-2">Search Documents</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query"
            className="border p-2 rounded flex-1"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Search
          </button>
        </div>
      </div>

      {/* Add URL Section */}
      <div className="mb-8">
        <h2 className="text-xl mb-2">Add Content from URL</h2>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
            className="border p-2 rounded flex-1"
          />
          <button
            onClick={handleAddUrl}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Add URL
          </button>
        </div>
      </div>

      {/* Add Document Section */}
      <div className="mb-8">
        <h2 className="text-xl mb-2">Add New Document</h2>
        <div className="flex flex-col gap-2">
          <textarea
            value={newDocument}
            onChange={(e) => setNewDocument(e.target.value)}
            placeholder="Enter document content"
            className="border p-2 rounded h-32"
          />
          <button
            onClick={handleAddDocument}
            className="bg-green-500 text-white px-4 py-2 rounded self-start"
          >
            Add Document
          </button>
        </div>
      </div>
      
      {/* Messages */}
      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}
      {message && (
        <div className="text-green-500 mb-4">{message}</div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {results.map((doc, index) => (
          <div key={index} className="p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col gap-1">
                <div className="text-sm text-gray-500">
                  Added: {new Date(doc.created_at).toLocaleString()}
                </div>
                {doc.publisher_name && (
                  <div className="text-sm text-gray-600">
                    Source: {doc.publisher_name}
                    {doc.author && <span> • By {doc.author}</span>}
                    {doc.source_url && (
                      <span> • <a href={doc.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Read original</a></span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
            
            <div className="prose max-w-none mb-4">
              {doc.content.split('\n').map((paragraph: string, i: number) => (
                <p key={i} className="mb-2">{paragraph}</p>
              ))}
            </div>

            {doc.named_entities ? (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Named Entities:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(doc.named_entities as Record<string, string[]>).map(([type, entities]) => (
                    entities.length > 0 && (
                      <div key={type} className="flex flex-wrap gap-1">
                        {entities.map((entity: string, i: number) => (
                          <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100">
                            {entity}
                          </span>
                        ))}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="text-sm text-gray-500">Extracting metadata...</div>
                <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {doc.categories ? (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Categories:</div>
                <div className="flex flex-wrap gap-2">
                  {doc.categories.map((category: string, i: number) => (
                    <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            ) : null }

            {doc.similarity !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.round(doc.similarity * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {Math.round(doc.similarity * 100)}% relevant
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
