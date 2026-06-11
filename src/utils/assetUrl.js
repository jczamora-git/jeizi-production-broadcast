const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";

export function resolveAssetUrl(path) {
  if (!path) return "";

  const cleanPath = String(path).trim();
  if (!cleanPath) return "";

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/uploads/")) {
    return `${API_ORIGIN}${cleanPath}`;
  }

  if (cleanPath.startsWith("/legacy/")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("uploads/")) {
    return `${API_ORIGIN}/${cleanPath}`;
  }

  if (cleanPath.startsWith("legacy/")) {
    return `/${cleanPath}`;
  }

  return cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
}
