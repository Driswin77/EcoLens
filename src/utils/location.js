export async function getPlaceName(lat, lng) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
  );

  const data = await res.json();

  if (data.results?.length) {
    return data.results[0].formatted_address;
  }

  return "Unknown location";
}
