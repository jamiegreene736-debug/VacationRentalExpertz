import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  ExternalLink,
  Home,
  Image as ImageIcon,
  Layers,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import logoImage from "./assets/brand/vacation-rental-expertz-logo-horizontal.png";
import mobileLogoImage from "./assets/brand/vacation-rental-expertz-logo-stacked.png";
import johnHeadshot from "./assets/brand/john-carpenter-headshot.jpg";
import { fetchGuestyCollections } from "./guesty";

const stats = [
  { value: "2x", label: "nearby resort condos instead of one oversized house" },
  { value: "2+3", label: "flexible bedroom mixes matched to the group" },
  { value: "2 doors", label: "close for the fun, separate for wind-down time" },
];

const trustPoints = [
  "The best combination may be 2 bedrooms plus 3 bedrooms, 3 plus 3, or another mix that fits the group.",
  "We work closely with property managers to curate the best two condos to combine at each resort or community.",
  "Our sweet spots are Hawaii resort stays and Central Florida / Disney World area group trips.",
  "When the day winds down, everyone gets useful separation: two kitchens, two living rooms, and quieter sleeping zones.",
  "Every combo clearly discloses that the stay is made from two separate nearby units.",
];

const processSteps = [
  {
    title: "Curate With Managers",
    body: "We work with property managers to identify the best two nearby condos to combine at the resort, then present them as one clear group option.",
    icon: <Layers size={22} />,
  },
  {
    title: "Keep It Current",
    body: "Availability, photos, details, and rates stay connected to the live listing data, so guests see real options instead of stale filler.",
    icon: <Check size={22} />,
  },
  {
    title: "Show The Fit",
    body: "Each listing explains why the pair works: same resort or nearby community, better value than a giant house, and useful separation at night.",
    icon: <DoorOpen size={22} />,
  },
];

const defaultSearch = {
  city: "",
  checkIn: "",
  checkOut: "",
  guests: "12",
};

const destinationSuggestions = ["Hawaii", "Maui", "Kauai", "Orlando", "Disney World", "Central Florida"];
const searchFields = ["city", "checkIn", "checkOut", "guests"];

function getSearchFromUrl() {
  if (typeof window === "undefined") return defaultSearch;

  const params = new URLSearchParams(window.location.search);

  return searchFields.reduce(
    (currentSearch, field) => ({
      ...currentSearch,
      [field]: params.get(field) || defaultSearch[field],
    }),
    { ...defaultSearch },
  );
}

function isSearchRoute() {
  return typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "") === "/search";
}

function createSearchPath(searchState) {
  const params = new URLSearchParams();

  searchFields.forEach((field) => {
    if (searchState[field]) params.set(field, searchState[field]);
  });

  const query = params.toString();
  return `/search${query ? `?${query}` : ""}`;
}

const contact = {
  name: "John Carpenter",
  phone: "(808) 460-6509",
  phoneHref: "tel:+18084606509",
  email: "stays@vacationrentalexpertz.com",
};

const aboutHighlights = [
  {
    title: "What we curate",
    body: "Combined resort stays made from two nearby condos with the right bedroom mix, layout, and value for the group.",
  },
  {
    title: "Who we work with",
    body: "Property managers who know the resort layout, unit quality, guest flow, and which condos are actually close enough to combine.",
  },
  {
    title: "Where we focus",
    body: "Hawaii, Central Florida, the Disney World area, and tropical resort destinations where group space is expensive.",
  },
];

const teamMembers = [
  {
    name: contact.name,
    role: "Founder / Lead stay strategist",
    badge: "22 years in vacation rentals",
    image: johnHeadshot,
    bio: [
      "John Carpenter has spent 22 years in vacation rentals, helping guests, owners, and property managers understand what actually makes a group stay work. He knows how to spot the value hidden between listings: the right resort, the right sleeping setup, the right condo pair, and the right amount of togetherness without crowding everyone under one roof.",
      "A Hawaii local with a love for Florida too, John is happiest around tropical weather, warm water, and easy access to the good stuff, from island resort days to Central Florida theme-park trips. That is the spirit behind VacationRentalExpertz: smart resort stays, honest guidance, and more room for the good parts of the trip.",
    ],
  },
];

function formatCurrency(value) {
  if (!value) return "Quote";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRateRange(rate) {
  const minPrice = Number(rate?.minPrice || rate?.price || 0);
  const maxPrice = Number(rate?.maxPrice || rate?.price || 0);

  if (minPrice && maxPrice && minPrice !== maxPrice) {
    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
  }

  return formatCurrency(rate?.price || minPrice || maxPrice);
}

function getStatusLabel(status) {
  if (status === "loading") return "Loading stays";
  if (status === "live") return "Live stays";
  if (status === "empty") return "No stays found";
  if (status === "error") return "Listings unavailable";
  return "Checking stays";
}

function formatMetric(value, singular, plural = `${singular}s`) {
  if (!value) return "";
  return `${value} ${value === 1 ? singular : plural}`;
}

function createInquiryUrl(stay, search) {
  const params = new URLSearchParams({
    subject: `Quote request: ${stay.title}`,
    body: [
      `I'm interested in ${stay.title}.`,
      "",
      `Location: ${stay.location}`,
      `Dates: ${search.checkIn || "Flexible"} to ${search.checkOut || "Flexible"}`,
      `Guests: ${search.guests || "Flexible"}`,
      `Bedroom target: ${search.bedrooms || stay.bedrooms}`,
      "",
      "Please send availability, seasonal pricing, and the details for both included condos.",
    ].join("\n"),
  });

  return `mailto:stays@vacationrentalexpertz.com?${params.toString()}`;
}

function getStayPhotos(stay) {
  if (!stay) return [];

  const photos = Array.isArray(stay.photos) ? stay.photos : [];
  const allPhotos = [stay.image, ...photos].filter(Boolean);

  return allPhotos.filter((photo, index) => allPhotos.indexOf(photo) === index);
}

function getDescriptionSections(stay) {
  if (!stay) return [];

  if (Array.isArray(stay.descriptionSections) && stay.descriptionSections.length > 0) {
    return stay.descriptionSections;
  }

  return stay.description ? [{ title: "About this stay", text: stay.description }] : [];
}

function addBookingParams(baseUrl, search) {
  if (!baseUrl) return "";

  try {
    const url = new URL(baseUrl, "https://www.vacationrentalexpertz.com");

    if (search.checkIn) url.searchParams.set("checkIn", search.checkIn);
    if (search.checkOut) url.searchParams.set("checkOut", search.checkOut);
    if (search.guests) url.searchParams.set("guests", search.guests);

    return url.toString();
  } catch {
    return baseUrl;
  }
}

function createBookingUrl(stay, search) {
  return addBookingParams(stay.bookingUrl, search) || createInquiryUrl(stay, search);
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSearchPage, setIsSearchPage] = useState(isSearchRoute);
  const [search, setSearch] = useState(getSearchFromUrl);
  const [submittedSearch, setSubmittedSearch] = useState(getSearchFromUrl);
  const [collections, setCollections] = useState([]);
  const [guestyStatus, setGuestyStatus] = useState("idle");
  const [guestyMessage, setGuestyMessage] = useState("");
  const [activeStay, setActiveStay] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    function handlePopState() {
      setIsSearchPage(isSearchRoute());

      if (isSearchRoute()) {
        const nextSearch = getSearchFromUrl();
        setSearch(nextSearch);
        setSubmittedSearch(nextSearch);
      }
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCollections() {
      setGuestyStatus("loading");
      setGuestyMessage("");

      try {
        const response = await fetchGuestyCollections(submittedSearch);

        if (ignore) return;

        setCollections(response.collections);
        setGuestyStatus(response.collections.length > 0 ? "live" : "empty");
        setGuestyMessage(
          response.collections.length > 0
            ? ""
            : "No matching stays are available right now. Try changing your search or contact us for current options.",
        );
      } catch (error) {
        if (ignore) return;

        setCollections([]);
        setActiveStay(null);
        setGuestyStatus("error");
        setGuestyMessage("Live stays are temporarily unavailable. Contact us and we will send current options.");
      }
    }

    loadCollections();

    return () => {
      ignore = true;
    };
  }, [submittedSearch]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [activeStay]);

  useEffect(() => {
    if (!activeStay) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setActiveStay(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeStay]);

  const visibleCollections = useMemo(() => {
    if (!submittedSearch.city.trim()) return collections;

    return collections.filter((stay) =>
      `${stay.title} ${stay.location} ${stay.resort}`.toLowerCase().includes(submittedSearch.city.toLowerCase()),
    );
  }, [collections, submittedSearch.city]);

  function updateSearch(event) {
    const { name, value } = event.target;
    setSearch((current) => ({ ...current, [name]: value }));
  }

  function navigateHome(event) {
    event?.preventDefault();

    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    setIsSearchPage(false);
    setMenuOpen(false);
  }

  function navigateToSearch(event, nextSearch = search) {
    event?.preventDefault();

    if (typeof window !== "undefined") {
      window.history.pushState({}, "", createSearchPath(nextSearch));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    setSearch(nextSearch);
    setSubmittedSearch(nextSearch);
    setIsSearchPage(true);
    setMenuOpen(false);
  }

  function applyDestination(destination) {
    const nextSearch = { ...search, city: destination };

    setSearch(nextSearch);
    setSubmittedSearch(nextSearch);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", createSearchPath(nextSearch));
    }
  }

  function handleSearch(event) {
    event.preventDefault();

    if (isSearchPage) {
      setSubmittedSearch(search);

      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", createSearchPath(search));
      }

      return;
    }

    navigateToSearch(undefined, search);
  }

  function openStay(stay) {
    setActiveStay(stay);
    setActivePhotoIndex(0);
  }

  function showNextPhoto(direction) {
    const photos = getStayPhotos(activeStay);
    if (photos.length < 2) return;

    setActivePhotoIndex((currentIndex) => (currentIndex + direction + photos.length) % photos.length);
  }

  function renderStayCard(stay) {
    const metrics = [
      { icon: <BedDouble size={17} />, label: formatMetric(stay.bedrooms, "bedroom") },
      { icon: <Bath size={17} />, label: formatMetric(stay.bathrooms, "bath") },
      { icon: <Users size={17} />, label: stay.guests ? `Sleeps ${stay.guests}` : "" },
    ].filter((metric) => metric.label);

    return (
      <article className="stay-card" key={stay.id}>
        <button className="stay-image-button" type="button" onClick={() => openStay(stay)}>
          {stay.image ? (
            <img src={stay.image} alt={stay.imageAlt} />
          ) : (
            <span className="photo-missing">
              <Building2 size={24} />
              Photo coming soon
            </span>
          )}
          {stay.badge && <span className="stay-badge">{stay.badge}</span>}
        </button>
        <div className="stay-body">
          {stay.location && (
            <div className="stay-location">
              <MapPin size={16} />
              {stay.location}
            </div>
          )}
          <button className="stay-title-button" type="button" onClick={() => openStay(stay)}>
            <h3>{stay.title}</h3>
          </button>
          {stay.summary && <p>{stay.summary}</p>}
          {metrics.length > 0 && (
            <div className="stay-metrics" aria-label={`${stay.title} details`}>
              {metrics.map((metric) => (
                <span key={metric.label}>
                  {metric.icon}
                  {metric.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="stay-footer">
          <strong>
            {formatCurrency(stay.price)}
            {stay.price ? <small>/night from listing</small> : <small>pricing on request</small>}
          </strong>
          <button type="button" onClick={() => openStay(stay)}>
            View stay
            <ArrowRight size={17} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header" data-open={menuOpen}>
        <a className="brand-lockup" href="/" onClick={navigateHome} aria-label="VacationRentalExpertz home">
          <img className="brand-logo brand-logo-desktop" src={logoImage} alt="VacationRentalExpertz" />
          <img className="brand-logo brand-logo-mobile" src={mobileLogoImage} alt="" aria-hidden="true" />
        </a>

        <button className="icon-button menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
          <span className="sr-only">Menu</span>
        </button>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="/search" onClick={navigateToSearch}>
            Search
          </a>
          <a href="/#method" onClick={() => setMenuOpen(false)}>
            Method
          </a>
          <a href="/#about" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="/#contact" onClick={() => setMenuOpen(false)}>
            Contact
          </a>
        </nav>

        <div className="header-actions">
          <a className="header-action phone-action" href={contact.phoneHref}>
            <Phone size={17} />
            {contact.phone}
          </a>
          <a className="header-action" href="/search" onClick={navigateToSearch}>
            <Search size={17} />
            Check dates
          </a>
        </div>
      </header>

      <main id="top">
        {isSearchPage ? (
          <section className="search-page-hero" aria-label="Search VacationRentalExpertz stays">
            <div className="search-page-copy">
              <p className="section-kicker">Search Curated Stays</p>
              <h1>Find the right two-condo setup.</h1>
              <p>
                Search live Guesty inventory for curated resort stays. Enter your destination,
                dates, and headcount, then open a listing for photos, seasonal pricing, amenities,
                and booking options.
              </p>
            </div>

            <aside className="search-assist-card" aria-label="Search support">
              <img src={johnHeadshot} alt="" />
              <div>
                <span>Need help choosing?</span>
                <strong>John can match the bedroom mix, resort layout, and group style.</strong>
                <a href={contact.phoneHref}>{contact.phone}</a>
              </div>
            </aside>

            <form className="search-panel search-page-panel" aria-label="Search combo stays" onSubmit={handleSearch}>
              <label>
                <span>Destination</span>
                <input
                  name="city"
                  type="search"
                  placeholder="Resort, city, area"
                  value={search.city}
                  onChange={updateSearch}
                />
              </label>
              <label>
                <span>Check in</span>
                <input name="checkIn" type="date" value={search.checkIn} onChange={updateSearch} />
              </label>
              <label>
                <span>Check out</span>
                <input name="checkOut" type="date" value={search.checkOut} onChange={updateSearch} />
              </label>
              <label>
                <span>Guests</span>
                <input name="guests" type="number" min="1" max="32" value={search.guests} onChange={updateSearch} />
              </label>
              <button type="submit">
                <Search size={18} />
                Search
              </button>
            </form>

            <div className="destination-chips" aria-label="Popular destinations">
              {destinationSuggestions.map((destination) => (
                <button key={destination} type="button" onClick={() => applyDestination(destination)}>
                  {destination}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="hero-section" aria-label="VacationRentalExpertz">
          <img
            className="hero-image"
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2200&q=86"
            alt=""
          />
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow">
              <Sparkles size={16} />
              Same resort energy. Better value. Breathing room.
            </p>
            <h1 aria-label="Two Condos. One Resort Stay.">
              <span className="hero-name-part">Two Condos.</span>
              <span className="hero-name-part">One Resort</span>
              <span className="hero-name-part">Stay.</span>
            </h1>
            <p className="hero-copy">
              Large beach homes and Disney-area vacation houses can get painfully expensive. We work
              closely with property managers to curate two nearby condos with the right bedroom mix,
              like 2 bedrooms plus 3 bedrooms or 3 plus 3, so your group stays together for the fun
              and still gets space when it is time to wind down.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="/search" onClick={navigateToSearch}>
                Find smarter resort stays
                <ArrowRight size={18} />
              </a>
              <a className="secondary-action" href="/#method">
                See the two-condo method
                <ChevronRight size={17} />
              </a>
            </div>
          </div>

          <form className="search-panel" aria-label="Search combo stays" onSubmit={handleSearch}>
            <label>
              <span>Destination</span>
              <input
                name="city"
                type="search"
                placeholder="Resort, city, area"
                value={search.city}
                onChange={updateSearch}
              />
            </label>
            <label>
              <span>Check in</span>
              <input name="checkIn" type="date" value={search.checkIn} onChange={updateSearch} />
            </label>
            <label>
              <span>Check out</span>
              <input name="checkOut" type="date" value={search.checkOut} onChange={updateSearch} />
            </label>
            <label>
              <span>Guests</span>
              <input name="guests" type="number" min="1" max="32" value={search.guests} onChange={updateSearch} />
            </label>
            <button type="submit">
              <Search size={18} />
              Search
            </button>
          </form>
        </section>

        <section className="proof-strip" aria-label="VacationRentalExpertz highlights">
          {stats.map((item) => (
            <div className="stat-item" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>

        <section className="intro-section">
          <div>
            <p className="section-kicker">The Smarter Resort Play</p>
            <h2>Close enough for the fun. Separate enough for the quiet.</h2>
          </div>
          <div className="intro-copy">
            <p>
              A large home in Hawaii or near Disney World can price out the whole trip.
              VacationRentalExpertz curates compatible nearby condos with property managers, choosing
              the bedroom mix that actually fits the group, and packages them as one clear option so
              families and friends can stay close for the fun while still having space to reset when
              the day gets long.
            </p>
            <ul className="trust-list">
              {trustPoints.map((point) => (
                <li key={point}>
                  <Check size={18} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-intro">
            <p className="section-kicker">About VacationRentalExpertz</p>
            <h2>A small, hands-on agency for smarter group resort stays.</h2>
            <p>
              VacationRentalExpertz exists for the trips where one huge house costs too much, but
              separate random rentals would scatter the group. We curate two-condo combinations with
              property managers so guests can see the value, layout, and tradeoffs clearly before
              they book.
            </p>
          </div>

          <div className="about-content">
            <div className="about-pillars">
              {aboutHighlights.map((item) => (
                <article className="about-pillar" key={item.title}>
                  <span>{item.title}</span>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="team-section" aria-label="VacationRentalExpertz team">
              <div className="team-heading">
                <span>Team</span>
                <h3>Meet the person behind the curation.</h3>
              </div>

              {teamMembers.map((member) => (
                <article className="team-profile" key={member.name}>
                  <div className="team-photo-card">
                    <img src={member.image} alt={member.name} />
                    <span>{member.badge}</span>
                  </div>
                  <div className="team-copy">
                    <span className="team-role">{member.role}</span>
                    <h3>{member.name}</h3>
                    {member.bio.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    <div className="team-actions">
                      <a href={contact.phoneHref}>
                        <Phone size={18} />
                        Call John at {contact.phone}
                      </a>
                      <a href={`mailto:${contact.email}`}>
                        <Mail size={18} />
                        {contact.email}
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
          </>
        )}

        <section className={isSearchPage ? "stays-section search-results-section" : "stays-section"} id="stays">
          <div className="section-heading">
            <div>
              <p className="section-kicker">{isSearchPage ? "Search Results" : "Resort Condo Combos"}</p>
              <h2>
                {isSearchPage
                  ? "Live curated stays that match your trip."
                  : "Skip the mansion markup. Keep the destination feeling."}
              </h2>
              {isSearchPage && (
                <p className="search-results-summary">
                  {guestyStatus === "loading"
                    ? "Checking Guesty for current inventory."
                    : `${visibleCollections.length} curated ${
                        visibleCollections.length === 1 ? "stay" : "stays"
                      }${submittedSearch.city ? ` for ${submittedSearch.city}` : ""}.`}
                </p>
              )}
            </div>
            <div className="live-pill" data-status={guestyStatus}>
              <span />
              {getStatusLabel(guestyStatus)}
            </div>
          </div>

          {guestyMessage && <p className="sync-note">{guestyMessage}</p>}

          {visibleCollections.length === 0 ? (
            <div className="empty-state" data-status={guestyStatus}>
              <Building2 size={28} />
              <h3>{guestyStatus === "loading" ? "Finding live stays" : "No live stays to show yet"}</h3>
              <p>
                {guestyStatus === "loading"
                  ? "The site is checking current stay options."
                  : guestyMessage ||
                    "No placeholder properties are being shown. Once live stays are available, this section will fill with real inventory."}
              </p>
            </div>
          ) : (
            <div className="collection-grid">
              {visibleCollections.map((stay) => renderStayCard(stay))}
            </div>
          )}
        </section>

        {activeStay &&
          (() => {
            const photos = getStayPhotos(activeStay);
            const currentPhoto = photos[activePhotoIndex] || "";
            const descriptionSections = getDescriptionSections(activeStay);
            const bookingUrl = createBookingUrl(activeStay, search);
            const hasDirectBookingUrl = Boolean(activeStay.bookingUrl);
            const seasonalPricing = Array.isArray(activeStay.seasonalPricing) ? activeStay.seasonalPricing : [];
            const listingFacts = [
              { icon: <BedDouble size={19} />, label: formatMetric(activeStay.bedrooms, "bedroom") },
              { icon: <Bath size={19} />, label: formatMetric(activeStay.bathrooms, "bath") },
              { icon: <Users size={19} />, label: activeStay.guests ? `Sleeps ${activeStay.guests}` : "" },
              { icon: <Home size={19} />, label: "Curated condo pair" },
            ].filter((fact) => fact.label);

            return (
              <div className="listing-modal-backdrop" role="presentation" onMouseDown={() => setActiveStay(null)}>
                <article
                  className="listing-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="listing-modal-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <button className="modal-close" type="button" onClick={() => setActiveStay(null)}>
                    <X size={20} />
                    <span className="sr-only">Close listing</span>
                  </button>

                  <div className="listing-gallery">
                    <div className="gallery-stage">
                      {currentPhoto ? (
                        <img src={currentPhoto} alt={activeStay.imageAlt} />
                      ) : (
                        <div className="detail-photo-missing">
                          <Building2 size={34} />
                          Photo coming soon
                        </div>
                      )}

                      {photos.length > 1 && (
                        <>
                          <button
                            className="gallery-nav gallery-nav-prev"
                            type="button"
                            onClick={() => showNextPhoto(-1)}
                            aria-label="Previous photo"
                          >
                            <ChevronLeft size={22} />
                          </button>
                          <button
                            className="gallery-nav gallery-nav-next"
                            type="button"
                            onClick={() => showNextPhoto(1)}
                            aria-label="Next photo"
                          >
                            <ChevronRight size={22} />
                          </button>
                        </>
                      )}

                      {photos.length > 0 && (
                        <span className="gallery-count">
                          <ImageIcon size={15} />
                          {activePhotoIndex + 1} / {photos.length}
                        </span>
                      )}
                    </div>

                    {photos.length > 1 && (
                      <div className="gallery-thumbs" aria-label="Listing photos">
                        {photos.map((photo, index) => (
                          <button
                            className="gallery-thumb"
                            data-active={index === activePhotoIndex}
                            key={photo}
                            type="button"
                            onClick={() => setActivePhotoIndex(index)}
                            aria-label={`Show photo ${index + 1}`}
                          >
                            <img src={photo} alt="" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="listing-content">
                    <div className="listing-main">
                      {activeStay.location && (
                        <div className="stay-location">
                          <MapPin size={16} />
                          {activeStay.location}
                        </div>
                      )}
                      <h2 id="listing-modal-title">{activeStay.title}</h2>

                      {listingFacts.length > 0 && (
                        <div className="listing-facts" aria-label={`${activeStay.title} facts`}>
                          {listingFacts.map((fact) => (
                            <span key={fact.label}>
                              {fact.icon}
                              {fact.label}
                            </span>
                          ))}
                        </div>
                      )}

                      <section className="curation-note">
                        <div>
                          <span>Curated with property managers</span>
                          <h3>Two condos chosen to work as one group stay.</h3>
                        </div>
                        <p>
                          VacationRentalExpertz works with property managers to understand the resort
                          layout, walking distance, bedroom mix, and guest flow before combining
                          condos. The result is a clearly disclosed two-unit stay with togetherness
                          for the main trip and separation when people need quiet.
                        </p>
                      </section>

                      {descriptionSections.length > 0 && (
                        <div className="listing-description">
                          {descriptionSections.map((section) => (
                            <section key={`${section.title}-${section.text}`}>
                              <h3>{section.title}</h3>
                              <p>{section.text}</p>
                            </section>
                          ))}
                        </div>
                      )}

                      <section className="seasonal-pricing-section">
                        <div className="seasonal-pricing-heading">
                          <h3>Seasonal pricing</h3>
                          <span>{activeStay.pricingSource || "Guesty rates"}</span>
                        </div>

                        {seasonalPricing.length > 0 ? (
                          <div className="seasonal-rate-grid">
                            {seasonalPricing.map((rate) => (
                              <div
                                className="seasonal-rate"
                                key={`${rate.label}-${rate.price}-${rate.minPrice}-${rate.maxPrice}`}
                              >
                                <span>{rate.label}</span>
                                <strong>{formatRateRange(rate)}</strong>
                                {rate.detail && <small>{rate.detail}</small>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="seasonal-rate seasonal-rate-wide">
                            <span>Live seasonal quote</span>
                            <strong>{formatCurrency(activeStay.price)}</strong>
                            <small>
                              Rates vary by season, holidays, weekends, availability, and the exact two
                              condos assigned. Enter dates or contact John for the current Guesty quote.
                            </small>
                          </div>
                        )}

                        {activeStay.pricingNote && <p>{activeStay.pricingNote}</p>}
                      </section>

                      {activeStay.amenities.length > 0 && (
                        <section className="amenity-section">
                          <h3>Amenities</h3>
                          <div className="amenity-grid" aria-label="Included amenities">
                            {activeStay.amenities.map((amenity) => (
                              <span key={amenity}>
                                <Check size={16} />
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>

                    <aside className="booking-panel" aria-label="Book this stay">
                      <div>
                        <span className="booking-kicker">Ready to stay?</span>
                        <strong>
                          {formatCurrency(activeStay.price)}
                          {activeStay.price ? <small>/night from listing</small> : <small>pricing on request</small>}
                        </strong>
                      </div>

                      <div className="booking-fields">
                        <label>
                          <span>Check in</span>
                          <input name="checkIn" type="date" value={search.checkIn} onChange={updateSearch} />
                        </label>
                        <label>
                          <span>Check out</span>
                          <input name="checkOut" type="date" value={search.checkOut} onChange={updateSearch} />
                        </label>
                        <label>
                          <span>Guests</span>
                          <input
                            name="guests"
                            type="number"
                            min="1"
                            max="32"
                            value={search.guests}
                            onChange={updateSearch}
                          />
                        </label>
                      </div>

                      <a
                        className="primary-action booking-action"
                        href={bookingUrl}
                        target={hasDirectBookingUrl ? "_blank" : undefined}
                        rel={hasDirectBookingUrl ? "noreferrer" : undefined}
                      >
                        {hasDirectBookingUrl ? "Book now" : "Request to book"}
                        {hasDirectBookingUrl ? <ExternalLink size={18} /> : <Mail size={18} />}
                      </a>

                      <p>
                        <CalendarDays size={16} />
                        Dates and guest count carry into the booking request.
                      </p>

                      <div className="booking-helper">
                        <img src={johnHeadshot} alt="" />
                        <div>
                          <strong>Need help matching the right two condos?</strong>
                          <a href={contact.phoneHref}>Call John at {contact.phone}</a>
                        </div>
                      </div>
                    </aside>
                  </div>
                </article>
              </div>
            );
          })()}

        {!isSearchPage && (
          <>
            <section className="method-section" id="method">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">The Listing Method</p>
                  <h2>The stay is simple to understand. The value is easy to see.</h2>
                </div>
              </div>
              <div className="process-grid">
                {processSteps.map((step, index) => (
                  <article className="process-card" key={step.title}>
                    <div className="process-top">
                      {step.icon}
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="contact-section" id="contact">
              <div>
                <p className="section-kicker">Plan A Group Stay</p>
                <h2>Tell John the destination, headcount, and dates. He will find the right two-condo fit.</h2>
                <p className="contact-person">
                  {contact.name} | Hawaii, Central Florida, Disney World area, and tropical resort stays
                </p>
              </div>
              <div className="contact-actions">
                <a className="contact-button" href={contact.phoneHref}>
                  <Phone size={18} />
                  {contact.phone}
                </a>
                <a className="contact-button secondary-contact" href={`mailto:${contact.email}`}>
                  <Mail size={18} />
                  {contact.email}
                </a>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        <div>
          <strong>VacationRentalExpertz</strong>
          <p>Two places. One amazing resort stay.</p>
        </div>
        <div className="footer-links">
          <a href="/search" onClick={navigateToSearch}>Search</a>
          <a href="/#about">About</a>
          <a href={contact.phoneHref}>{contact.phone}</a>
          <a href={`mailto:${contact.email}`}>Contact</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
