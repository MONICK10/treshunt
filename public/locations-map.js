// Real GPS position of each campus location, for the admin live map (Mapbox GL).
//
//   lat / lng = decimal degrees (WGS84), the same numbers Google Maps shows
//   when you right-click a spot and pick "What's here?" / copy coordinates.
//
// >>> EVERY value below is a PLACEHOLDER near the Karunya campus centre. <<<
// Replace each with the real coordinate:
//   Google Maps (desktop) -> search "Karunya Institute of Technology"
//   -> zoom into campus -> right-click the exact building -> copy the
//   lat, lng shown at the top of the menu -> paste here.
// Drop `placeholder: true` from a row once its coordinate is real — that
// flag only adds a small "unverified" ring to the marker, nothing else.
//
// A location with no entry here (or lat/lng missing) is simply left off the
// map; it still shows in the text route list below the map.

window.LOCATION_COORDS = {
  CS_DEPT:       { lat: 10.93570, lng: 76.74490, placeholder: true },

  CANTEEN:       { lat: 10.93545, lng: 76.74460, placeholder: true },
  CTC1:          { lat: 10.93600, lng: 76.74520, placeholder: true },
  MEDIA:         { lat: 10.93625, lng: 76.74555, placeholder: true },

  EMMANUEL_AUDI: { lat: 10.93490, lng: 76.74430, placeholder: true },
  BETHESDA:      { lat: 10.93460, lng: 76.74475, placeholder: true },
  LIBRARY:       { lat: 10.93580, lng: 76.74445, placeholder: true },

  CIVIL:         { lat: 10.93555, lng: 76.74585, placeholder: true },
  MECH:          { lat: 10.93615, lng: 76.74610, placeholder: true },
  AEROSPACE:     { lat: 10.93650, lng: 76.74635, placeholder: true },

  CHANDRAN:      { lat: 10.93680, lng: 76.74540, placeholder: true },
  AGRI:          { lat: 10.93720, lng: 76.74470, placeholder: true },
  CAKE_WORLD:    { lat: 10.93690, lng: 76.74405, placeholder: true },
};
