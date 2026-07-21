/** @type {import('next').NextConfig} */
const nextConfig = {
  // Frontend is UI-only now — all server work (including tesseract OCR) lives in
  // the standalone backend, so no server-package externalization is needed here.
};

export default nextConfig;
