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
  UserRound,
  X,
} from "lucide-react";
import logoImage from "./assets/brand/vacation-rental-expertz-header.svg";
import mobileLogoImage from "./assets/brand/vacation-rental-expertz-header-mobile.svg";
import { fetchGuestyCollections } from "./guesty";

const stats = [
  { value: "2x", label: "nearby beach condos instead of one oversized house" },
  { value: "6BR", label: "group-size comfort without the beachfront mansion price" },
  { value: "2 doors", label: "close for the fun, separate for wind-down time" },
];

const trustPoints = [
  "Two 3-bedroom beach condos are often far easier on the budget than a rare 6-bedroom beach house.",
  "Your group stays in the same resort, building, or walkable beach cluster for pool days, beach runs, and shared meals.",
  "When the day winds down, everyone gets useful separation: two kitchens, two living rooms, and quieter sleeping zones.",
  "Every combo clearly discloses that the stay is made from two separate nearby units.",
];

const processSteps = [
  {
    title: "Curate The Stay",
    body: "Each two-condo beach stay is presented as one clear group option with the right photos, bedroom count, pricing, and disclosure.",
    icon: <Layers size={22} />,
  },
  {
    title: "Keep It Current",
    body: "Availability, photos, details, and rates stay connected to the live listing data, so guests see real options instead of stale filler.",
    icon: <Check size={22} />,
  },
  {
    title: "Sell The Story",
    body: "Each page explains the simple value: beach groups stay close for the fun, save against a giant house, and get separation at night.",
    icon: <DoorOpen size={22} />,
  },
];

const defaultSearch = {
  city: "",
  checkIn: "",
  checkOut: "",
  guests: "12",
};

const contact = {
  name: "John Carpenter",
  phone: "(808) 460-6509",
  phoneHref: "tel:+18084606509",
  email: "stays@vacationrentalexpertz.com",
};

function formatCurrency(value) {
  if (!value) return "Quote";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
      "Please send availability, pricing, and the details for both included units.",
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
  const [search, setSearch] = useState(defaultSearch);
  const [submittedSearch, setSubmittedSearch] = useState(defaultSearch);
  const [collections, setCollections] = useState([]);
  const [guestyStatus, setGuestyStatus] = useState("idle");
  const [guestyMessage, setGuestyMessage] = useState("");
  const [activeStay, setActiveStay] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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

  function handleSearch(event) {
    event.preventDefault();
    setSubmittedSearch(search);
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

  return (
    <div className="site-shell">
      <header className="site-header" data-open={menuOpen}>
        <a className="brand-lockup" href="#top" aria-label="VacationRentalExpertz home">
          <img className="brand-logo brand-logo-desktop" src={logoImage} alt="VacationRentalExpertz" />
          <img className="brand-logo brand-logo-mobile" src={mobileLogoImage} alt="" aria-hidden="true" />
        </a>

        <button className="icon-button menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
          <span className="sr-only">Menu</span>
        </button>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="#stays" onClick={() => setMenuOpen(false)}>
            Combo stays
          </a>
          <a href="#method" onClick={() => setMenuOpen(false)}>
            Method
          </a>
          <a href="#john" onClick={() => setMenuOpen(false)}>
            John
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>
            Contact
          </a>
        </nav>

        <div className="header-actions">
          <a className="header-action phone-action" href={contact.phoneHref}>
            <Phone size={17} />
            {contact.phone}
          </a>
          <a className="header-action" href="#stays">
            <Search size={17} />
            Check dates
          </a>
        </div>
      </header>

      <main id="top">
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
              Same beach. Better value. Breathing room.
            </p>
            <h1 aria-label="Two Condos. One Beach Stay.">
              <span className="hero-name-part">Two Condos.</span>
              <span className="hero-name-part">One Beach</span>
              <span className="hero-name-part">Stay.</span>
            </h1>
            <p className="hero-copy">
              Six-bedroom beach houses can be painfully expensive. We pair two nearby 3-bedroom
              condos so your group stays together for the beach days, dinners, and memories, then
              gets just enough separation when it is time to wind down.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#stays">
                Find smarter beach stays
                <ArrowRight size={18} />
              </a>
              <a className="secondary-action" href="#method">
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
                placeholder="Beach, resort, city"
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
            <p className="section-kicker">The Smarter Beach Play</p>
            <h2>Close enough for the fun. Separate enough for the quiet.</h2>
          </div>
          <div className="intro-copy">
            <p>
              A true 6-bedroom house on the beach can price out the whole trip. VacationRentalExpertz
              packages compatible nearby condos as one clear group option, so families and friends
              can stay close for the fun while still having space to reset when the day gets long.
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

        <section className="expert-section" id="john">
          <div className="expert-intro">
            <p className="section-kicker">Your Vacation Rental Expert</p>
            <h2>John Carpenter knows the vacation rental game from the inside.</h2>
          </div>
          <div className="expert-profile">
            <div className="expert-avatar" aria-hidden="true">
              <UserRound size={34} />
              <span>JC</span>
            </div>
            <div className="expert-copy">
              <span className="expert-role">Lead stay strategist</span>
              <h3>{contact.name}</h3>
              <p>
                John Carpenter has spent 22 years in vacation rentals, helping guests, owners, and
                groups understand what actually makes a stay work. He knows how to spot the value
                hidden between listings: the right location, the right sleeping setup, and the right
                amount of togetherness without crowding everyone under one roof.
              </p>
              <p>
                A Hawaii local with a love for Florida too, John is happiest around tropical
                weather, warm water, and the kind of places where families can slow down and enjoy
                each other. That is the spirit behind VacationRentalExpertz: smart beach stays,
                honest guidance, and more room for the good parts of the trip.
              </p>
              <div className="expert-actions">
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
          </div>
        </section>

        <section className="stays-section" id="stays">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Beach Condo Combos</p>
              <h2>Skip the mansion markup. Keep the beachfront feeling.</h2>
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
              {visibleCollections.map((stay) => {
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
              })}
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
            const listingFacts = [
              { icon: <BedDouble size={19} />, label: formatMetric(activeStay.bedrooms, "bedroom") },
              { icon: <Bath size={19} />, label: formatMetric(activeStay.bathrooms, "bath") },
              { icon: <Users size={19} />, label: activeStay.guests ? `Sleeps ${activeStay.guests}` : "" },
              { icon: <Home size={19} />, label: "Two-place stay" },
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
                    </aside>
                  </div>
                </article>
              </div>
            );
          })()}

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
            <h2>Tell John the beach, headcount, and dates. He will find the right two-condo fit.</h2>
            <p className="contact-person">
              {contact.name} | Vacation rental expert with 22 years of experience
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
      </main>

      <footer className="site-footer">
        <div>
          <strong>VacationRentalExpertz</strong>
          <p>Two places. One amazing beach stay.</p>
        </div>
        <div className="footer-links">
          <a href="#stays">Combo stays</a>
          <a href="#john">John Carpenter</a>
          <a href={contact.phoneHref}>{contact.phone}</a>
          <a href={`mailto:${contact.email}`}>Contact</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
