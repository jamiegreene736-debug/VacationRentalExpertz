const guestyEndpoint = import.meta.env.VITE_GUESTY_PROXY_URL || "/api/guesty";

export const fallbackCollections = [
  {
    id: "azure-six-bedroom",
    title: "Azure Resort 6-Bedroom Pairing",
    resort: "Azure Resort",
    location: "Miramar Beach, Florida",
    badge: "Two 3BR condos",
    bedrooms: 6,
    bathrooms: 6,
    guests: 16,
    price: 845,
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=82",
    imageAlt: "Bright resort living room with oceanfront vacation rental styling",
    summary:
      "Two nearby 3-bedroom condos in the same beachfront resort, priced and packaged as the smarter alternative to one rare 6-bedroom beach house.",
    description:
      "This combo is presented as one group-sized stay while clearly including two separate 3-bedroom condos. It is ideal for families who want beach days, pools, and meals together, then two quiet spaces when kids go down, grandparents need rest, or friends want their own evening rhythm.",
    units: [
      { name: "Condo A", detail: "3 bedrooms, full kitchen, balcony, primary suite" },
      { name: "Condo B", detail: "3 bedrooms, full kitchen, balcony, guest suite layout" },
    ],
    amenities: ["Beach access", "Resort pool", "Two kitchens", "Wind-down space", "Balconies", "Washer/dryer"],
  },
  {
    id: "harbor-eight-bedroom",
    title: "Harbor House 8-Bedroom Collection",
    resort: "Harbor House",
    location: "Orange Beach, Alabama",
    badge: "Two 4BR residences",
    bedrooms: 8,
    bathrooms: 7,
    guests: 20,
    price: 1120,
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=82",
    imageAlt: "Upscale vacation rental dining and lounge space prepared for a group",
    summary:
      "A beach-area pairing for reunions and wedding guests who want shared access to the fun without paying the premium for one huge house.",
    description:
      "Two coordinated residences give the group eight bedrooms, multiple gathering zones, and a cleaner arrival experience. Everyone can gather for beach time and dinner, then split naturally when the night gets quieter.",
    units: [
      { name: "Residence A", detail: "4 bedrooms, open gathering space, private patio" },
      { name: "Residence B", detail: "4 bedrooms, secondary lounge, dedicated parking" },
    ],
    amenities: ["Beach nearby", "Two living rooms", "Outdoor dining", "Parking", "Fast Wi-Fi", "Quiet bedrooms"],
  },
  {
    id: "palms-seven-bedroom",
    title: "The Palms 7-Bedroom Retreat",
    resort: "The Palms",
    location: "Kissimmee, Florida",
    badge: "3BR + 4BR villas",
    bedrooms: 7,
    bathrooms: 5,
    guests: 18,
    price: 930,
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=82",
    imageAlt: "Modern resort home with a bright lounge and poolside vacation atmosphere",
    summary:
      "A resort-ready pairing with two nearby villas, shared amenities, and private zones for the part of the trip when everyone needs a reset.",
    description:
      "This option pairs a 3-bedroom villa with a nearby 4-bedroom villa so extended families can keep cousins, grandparents, and friend groups close without forcing everyone into the same floor plan after a long day out.",
    units: [
      { name: "Villa A", detail: "3 bedrooms, family kitchen, resort shuttle access" },
      { name: "Villa B", detail: "4 bedrooms, larger lounge, private outdoor space" },
    ],
    amenities: ["Pool access", "Two kitchens", "Family rooms", "Self check-in", "Laundry", "Separate nights"],
  },
];

function normalizeCollection(stay) {
  return {
    ...stay,
    id: String(stay.id || stay._id || stay.title),
    title: stay.title || stay.nickname || "Guesty combined stay",
    resort: stay.resort || stay.address?.city || "VacationRentalExpertz",
    location: stay.location || [stay.address?.city, stay.address?.state, stay.address?.country].filter(Boolean).join(", "),
    badge: stay.badge || "Guesty combined listing",
    bedrooms: Number(stay.bedrooms || 0),
    bathrooms: Number(stay.bathrooms || 0),
    guests: Number(stay.guests || stay.accommodates || 0),
    price: Number(stay.price || 0),
    image: stay.image || fallbackCollections[0].image,
    imageAlt: stay.imageAlt || `${stay.title || "Vacation rental"} interior`,
    summary: stay.summary || "A Guesty-powered combined stay that gives beach groups room to gather and room to wind down.",
    description:
      stay.description ||
      "This stay is maintained in Guesty as one combined, guest-facing listing with the two-place setup described for guests.",
    units: Array.isArray(stay.units) && stay.units.length > 0 ? stay.units : fallbackCollections[0].units,
    amenities: Array.isArray(stay.amenities) && stay.amenities.length > 0 ? stay.amenities.slice(0, 8) : fallbackCollections[0].amenities,
    guestyListingId: stay.guestyListingId || stay._id || stay.id || "",
  };
}

export async function fetchGuestyCollections(search) {
  const params = new URLSearchParams();

  Object.entries(search).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const response = await fetch(`${guestyEndpoint}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Guesty-ready demo inventory is showing until the live combined-listing proxy is connected.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Guesty inventory is not connected yet.");
  }

  const payload = await response.json();
  const collections = Array.isArray(payload.collections) ? payload.collections.map(normalizeCollection) : [];

  return {
    source: payload.source || "guesty",
    message: payload.message || "",
    collections,
  };
}
