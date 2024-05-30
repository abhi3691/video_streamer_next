"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import axios from "axios";
import ReactPlayer from "react-player";

export default function AdminPanel() {
  const [uploadedVideos, setUploadedVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  useLayoutEffect(() => {
    const loadVideos = async () => {
      try {
        const response = await axios.get("/api/videos");
        setUploadedVideos(response?.data?.urls);
        if (response?.data?.urls?.length) {
          setSelectedVideo(response?.data?.urls[0].url);
        }
      } catch (error) {
        console.error("Error fetching videos:", error);
      }
    };
    loadVideos();
  }, []);

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setToastMessage("");
    const formData = new FormData();
    const fileField: any = document.getElementById(
      "videoFile"
    ) as HTMLInputElement;

    formData.append("video", fileField.files[0]);

    try {
      const response = await axios.post("/api/upload", formData);
      setLoading(false);
      setToastMessage("Video uploaded successfully!");
      setUploadedVideos([...uploadedVideos, response.data.url]);
      setSelectedVideo(response.data.url);
    } catch (error) {
      setLoading(false);
      setToastMessage("Error uploading video.");
      console.error("Error uploading video:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans bg-gray-900">
      <h1 className="text-4xl font-semibold text-gray-100 mb-8">Admin Panel</h1>

      <form
        id="uploadForm"
        encType="multipart/form-data"
        onSubmit={handleFormSubmit}
        className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 p-8 rounded-lg shadow-lg mb-8 w-96"
      >
        <input
          type="file"
          id="videoFile"
          name="video"
          accept="video/*"
          required
          className="text-white p-3 mb-4 border border-gray-600 rounded-md w-full bg-gray-700"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white py-3 px-6 rounded-md hover:bg-blue-600 transition duration-300"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Video"}
        </button>
      </form>

      {toastMessage && (
        <div className="bg-green-500 text-white p-3 rounded-md mb-4">
          {toastMessage}
        </div>
      )}

      <div className="w-full max-w-4xl">
        <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-lg shadow-lg mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Select Video
          </h2>
          <select
            value={selectedVideo}
            onChange={(e) => setSelectedVideo(e.target.value)}
            className="w-full bg-gray-700 text-white p-3 border border-gray-600 rounded-md focus:outline-none"
          >
            <option value="">Select a video</option>
            {uploadedVideos.map((value, index) => (
              <option key={index} value={value?.url}>
                {value?.url}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-lg shadow-lg mb-8 overflow-hidden">
          {selectedVideo && (
            <ReactPlayer
              url={selectedVideo}
              controls
              playing={selectedVideo !== ""}
              width="100%"
              height="100%"
            />
          )}
        </div>
      </div>
    </div>
  );
}
