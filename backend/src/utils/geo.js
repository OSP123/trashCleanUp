function normalizeLatLng(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { lat: latitude, lng: longitude };
}

function inBBox(point, bbox) {
  if (!bbox) return true;
  const { minLat, minLng, maxLat, maxLng } = bbox;
  return (
    point.lat >= minLat &&
    point.lat <= maxLat &&
    point.lng >= minLng &&
    point.lng <= maxLng
  );
}

function polygonToWkt(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return null;
  const normalized = polygon
    .map((point) => normalizeLatLng(point.lat, point.lng))
    .filter(Boolean);
  if (normalized.length < 3) return null;

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (first.lat !== last.lat || first.lng !== last.lng) {
    normalized.push(first);
  }

  const coords = normalized.map((point) => `${point.lng} ${point.lat}`).join(", ");
  return `POLYGON((${coords}))`;
}

function geojsonToPolygon(geojson) {
  if (!geojson || geojson.type !== "Polygon") return null;
  const ring = geojson.coordinates && geojson.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const points = ring.map(([lng, lat]) => ({ lat, lng }));
  const first = points[0];
  const last = points[points.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) {
    points.pop();
  }
  return points;
}

module.exports = { normalizeLatLng, inBBox, polygonToWkt, geojsonToPolygon };
