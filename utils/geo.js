const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

function isValidLatitude(latitude) {
  return (
    typeof latitude === "number" &&
    !Number.isNaN(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function isValidLongitude(longitude) {
  return (
    typeof longitude === "number" &&
    !Number.isNaN(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isValidCoordinates(latitude, longitude) {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}

module.exports = {
  haversineMeters,
  isValidCoordinates,
  isValidLatitude,
  isValidLongitude,
};
