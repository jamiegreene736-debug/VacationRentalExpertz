import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  DoorOpen,
  Home,
  Layers,
  Mail,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Waves,
  X,
} from "lucide-react";
import logoImage from "./assets/brand/vacation-rental-expertz-header.svg";
import mobileLogoImage from "./assets/brand/vacation-rental-expertz-header-mobile.svg";
import { fallbackCollections, fetchGuestyCollections } from "./guesty";

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
    title: "Build In Guesty",
    body: "Your team creates each two-condo beach stay as one combined Guesty listing with the right photos, bedroom count, pricing, and disclosure.",
    icon: <Layers size={22} />,
  },
  {
    title: "Sync The Stay",
    body: "The website pulls those already-combined Guesty listings directly, so the site is not trying to pair separate units behind the scenes.",
    icon: <ShieldCheck size={22} />,
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

function formatCurrency(value) {
  if (!value) return "Quote";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState(defaultSearch);
  const [submittedSearch, setSubmittedSearch] = useState(defaultSearch);
  const [collections, setCollections] = useState(fallbackCollections);
  const [guestyStatus, setGuestyStatus] = useState("idle");
  const [guestyMessage, setGuestyMessage] = useState("");
  const [activeStay, setActiveStay] = useState(fallbackCollections[0]);

  useEffect(() => {
    let ignore = false;

    async function loadCollections() {
      setGuestyStatus("loading");
      setGuestyMessage("");

      try {
        const response = await fetchGuestyCollections(submittedSearch);

        if (ignore) return;

        if (response.collections.length > 0) {
          setCollections(response.collections);
          setActiveStay(response.collections[0]);
          setGuestyStatus(response.source === "guesty" ? "live" : "demo");
          setGuestyMessage(response.message || "");
          return;
        }

        setCollections(fallbackCollections);
        setActiveStay(fallbackCollections[0]);
        setGuestyStatus("demo");
        setGuestyMessage("Demo listings are showing until Guesty returns matching combined listings.");
      } catch (error) {
        if (ignore) return;

        setCollections(fallbackCollections);
        setActiveStay(fallbackCollections[0]);
        setGuestyStatus("demo");
        setGuestyMessage(error.message || "Demo listings are showing until Guesty is connected.");
      }
    }

    loadCollections();

    return () => {
      ignore = true;
    };
  }, [submittedSearch]);

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
          <a href="#guesty" onClick={() => setMenuOpen(false)}>
            Guesty sync
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>
            Contact
          </a>
        </nav>

        <a className="header-action" href="#stays">
          <Search size={17} />
          Check dates
        </a>
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

        <section className="stays-section" id="stays">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Beach Condo Combos</p>
              <h2>Skip the mansion markup. Keep the beachfront feeling.</h2>
            </div>
            <div className="live-pill" data-status={guestyStatus}>
              <span />
              {guestyStatus === "live" ? "Guesty live combined listings" : "Guesty-ready demo inventory"}
            </div>
          </div>

          {guestyMessage && <p className="sync-note">{guestyMessage}</p>}

          <div className="collection-grid">
            {visibleCollections.map((stay) => (
              <article className="stay-card" key={stay.id}>
                <button className="stay-image-button" type="button" onClick={() => setActiveStay(stay)}>
                  <img src={stay.image} alt={stay.imageAlt} />
                  <span>{stay.badge}</span>
                </button>
                <div className="stay-body">
                  <div className="stay-location">
                    <MapPin size={16} />
                    {stay.location}
                  </div>
                  <h3>{stay.title}</h3>
                  <p>{stay.summary}</p>
                  <div className="stay-metrics" aria-label={`${stay.title} details`}>
                    <span>
                      <BedDouble size={17} />
                      {stay.bedrooms} bedrooms
                    </span>
                    <span>
                      <Bath size={17} />
                      {stay.bathrooms} baths
                    </span>
                    <span>
                      <Users size={17} />
                      Sleeps {stay.guests}
                    </span>
                  </div>
                </div>
                <div className="stay-footer">
                  <strong>
                    {formatCurrency(stay.price)}
                    {stay.price ? <small>/night from</small> : <small>prepared by team</small>}
                  </strong>
                  <button type="button" onClick={() => setActiveStay(stay)}>
                    Details
                    <ArrowRight size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section" aria-label="Selected combo stay details">
          <div className="detail-media">
            <img src={activeStay.image} alt={activeStay.imageAlt} />
          </div>
          <div className="detail-copy">
            <p className="section-kicker">Current Selection</p>
            <h2>{activeStay.title}</h2>
            <p>{activeStay.description}</p>
            <div className="unit-list">
              {activeStay.units.map((unit) => (
                <div className="unit-row" key={unit.name}>
                  <Home size={19} />
                  <div>
                    <strong>{unit.name}</strong>
                    <span>{unit.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="amenity-cloud" aria-label="Included amenities">
              {activeStay.amenities.map((amenity) => (
                <span key={amenity}>{amenity}</span>
              ))}
            </div>
            <a className="primary-action dark" href={createInquiryUrl(activeStay, submittedSearch)}>
              Request this combo
              <Mail size={18} />
            </a>
          </div>
        </section>

        <section className="method-section" id="method">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">The Listing Method</p>
              <h2>Guesty holds the combined stay. The website makes the value obvious.</h2>
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

        <section className="guesty-section" id="guesty">
          <div className="guesty-copy">
            <p className="section-kicker">Guesty API Integration</p>
            <h2>The website pulls your combined Guesty listings directly.</h2>
            <p>
              The frontend calls a server-side API route, which requests Guesty listings with your
              Booking Engine credentials and returns your already-combined beach condo listings to
              the page. Secrets stay on the server.
            </p>
          </div>
          <div className="integration-list">
            <div>
              <Building2 size={21} />
              <strong>Listing data</strong>
              <span>Titles, photos, amenities, address fields, bedrooms, baths, and occupancy.</span>
            </div>
            <div>
              <CalendarDays size={21} />
              <strong>Date-aware search</strong>
              <span>Guesty check-in and check-out filters keep combos tied to unit availability.</span>
            </div>
            <div>
              <Waves size={21} />
              <strong>Combined listings</strong>
              <span>Guesty remains the place where each two-condo stay is built, priced, and described.</span>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div>
            <p className="section-kicker">Plan A Group Stay</p>
            <h2>Tell us the beach, headcount, and dates. We will find the right two-condo fit.</h2>
          </div>
          <a className="contact-button" href="mailto:stays@vacationrentalexpertz.com">
            <Mail size={18} />
            stays@vacationrentalexpertz.com
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>VacationRentalExpertz</strong>
          <p>Two places. One amazing beach stay.</p>
        </div>
        <div className="footer-links">
          <a href="#stays">Combo stays</a>
          <a href="#guesty">Guesty sync</a>
          <a href="mailto:stays@vacationrentalexpertz.com">Contact</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
