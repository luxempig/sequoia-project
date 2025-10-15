import React, { useState, useEffect } from "react";
import Layout from "./Layout";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface Folder {
  name: string;
  path: string;
  type: "folder";
}

interface FileItem {
  name: string;
  path: string;
  size: number;
  last_modified: string;
  type: "image" | "video" | "pdf" | "document";
  url: string;
}

interface S3BrowseResponse {
  bucket: string;
  current_prefix: string;
  breadcrumbs: BreadcrumbItem[];
  folders: Folder[];
  files: FileItem[];
  total_items: number;
}

const MediaExplorer: React.FC = () => {
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [data, setData] = useState<S3BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    loadDirectory(currentPrefix);
  }, [currentPrefix]);

  const loadDirectory = async (prefix: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/s3/browse?prefix=${encodeURIComponent(prefix)}&bucket=sequoia-canonical`
      );
      if (!response.ok) {
        throw new Error("Failed to load directory");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(`Error loading directory: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return "🖼️";
      case "video":
        return "🎬";
      case "pdf":
        return "📄";
      default:
        return "📋";
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Media Explorer</h1>
            <p className="text-gray-600">Browse sequoia-canonical S3 bucket contents</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 border-b pb-4">
              <button
                onClick={() => setCurrentPrefix("")}
                className="hover:text-blue-600 font-medium"
              >
                📦 Root
              </button>
              {data?.breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <span>/</span>
                  <button
                    onClick={() => setCurrentPrefix(crumb.path)}
                    className="hover:text-blue-600"
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            )}

            {/* Directory Contents */}
            {!loading && data && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Folders and Files List */}
                <div className="lg:col-span-2 space-y-2">
                  <div className="text-sm text-gray-600 mb-4">
                    {data.total_items} items
                  </div>

                  {/* Folders */}
                  {data.folders.map((folder) => (
                    <div
                      key={folder.path}
                      onClick={() => setCurrentPrefix(folder.path)}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                    >
                      <span className="text-2xl">📁</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{folder.name}</p>
                        <p className="text-xs text-gray-500">Folder</p>
                      </div>
                    </div>
                  ))}

                  {/* Files */}
                  {data.files.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFile?.path === file.path
                          ? "bg-blue-100 border-blue-400"
                          : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">{getFileIcon(file.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)} • {formatDate(file.last_modified)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {data.total_items === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">This folder is empty</p>
                    </div>
                  )}
                </div>

                {/* File Preview Panel */}
                <div className="lg:col-span-1">
                  {selectedFile ? (
                    <div className="border border-gray-200 rounded-lg p-4 sticky top-4">
                      <h3 className="font-semibold text-gray-900 mb-4 truncate">
                        {selectedFile.name}
                      </h3>

                      {/* Preview based on file type */}
                      {selectedFile.type === "image" && (
                        <div className="mb-4">
                          <img
                            src={selectedFile.url}
                            alt={selectedFile.name}
                            className="w-full rounded-lg border border-gray-300"
                          />
                        </div>
                      )}

                      {selectedFile.type === "video" && (
                        <div className="mb-4">
                          <video
                            controls
                            className="w-full rounded-lg border border-gray-300"
                            src={selectedFile.url}
                          >
                            Your browser does not support video playback.
                          </video>
                        </div>
                      )}

                      {selectedFile.type === "pdf" && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
                          <span className="text-6xl">📄</span>
                          <p className="text-sm text-gray-600 mt-2">PDF Document</p>
                        </div>
                      )}

                      {selectedFile.type === "document" && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
                          <span className="text-6xl">📋</span>
                          <p className="text-sm text-gray-600 mt-2">Document</p>
                        </div>
                      )}

                      {/* File Details */}
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Size:</span>
                          <span className="ml-2 text-gray-600">{formatFileSize(selectedFile.size)}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Type:</span>
                          <span className="ml-2 text-gray-600">{selectedFile.type}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Modified:</span>
                          <span className="ml-2 text-gray-600">{formatDate(selectedFile.last_modified)}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 space-y-2">
                        <a
                          href={selectedFile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Open in New Tab
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedFile.url);
                            alert("URL copied to clipboard!");
                          }}
                          className="block w-full bg-gray-200 text-gray-800 text-center px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Copy URL
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500 sticky top-4">
                      <p>Select a file to preview</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MediaExplorer;
