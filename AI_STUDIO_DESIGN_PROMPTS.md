# Using Google AI Studio for CineVerse website design

## How to use it (and what NOT to do)
AI Studio (use its app-building / "Build" mode if your account has it, otherwise chat with Gemini) is best for **fast visual exploration**: layouts, colours, copy and look-and-feel for each screen. Treat what it makes as a **design prototype and reference**, not as the production code.

- Do design one screen at a time; compare 2 or 3 options; pick the best; then hand the winning screenshots plus the token summary to Antigravity (prompt at the end).
- Do NOT merge AI Studio's code into the repo. Our app is Next.js with Tailwind, a FastAPI backend, security rules (`SECURITY_SPEC.md`) and tested booking logic; prototype code ignores all of that.
- Do NOT paste API keys, `.env` files, payment keys, customer data or the whole repo into AI Studio. The 3D model file is not needed there.
- Do NOT try to rebuild the 3D theatre in AI Studio. Use a placeholder image with a "See it in 3D" button; the real 3D stays in the repo.
- Keep sample data fake and clearly placeholder (invented movie titles, no real posters or trailers you do not have rights to).
- Expect it to drift toward dark themes and small text. Re-state the rules each round (they are in the brief below).

## Step 1: set the brief once (paste first, keep it in the conversation)

```
You are a senior product designer. Design the website "CineVerse", a movie ticket booking site for India, where people can also preview their seat in 3D before booking.

Goals: simple, friendly, fast. A first-time user must book 2 seats in 3 clear steps: 1 Choose show, 2 Choose seats, 3 Pay. The standard 2D seat map is the default; a clear but secondary button "See it in 3D" opens an immersive theatre view (just show a placeholder image for it).

HARD DESIGN RULES (do not break them):
- LIGHT, rich-colour theme. Page background warm ivory #FFF8F1, cards white, soft tinted sections (#FDEBD8 peach, #EAF1FF sky, #E6F6F0 mint). Rich colour bands for heroes and step headers: burgundy-magenta gradient (#7A0F2E to #C2185B), indigo-violet (#2B1B6B to #5B3FD0), teal-emerald (#0B6E6A to #12A594), always with white text. Primary buttons crimson #C8102E. Gold #F2A900 for ratings, teal #0E8F8A for success.
- Text colour #1B1320, muted #4A4056. All text must pass 4.5:1 contrast.
- TYPE: body 18px, line-height 1.6, NOTHING smaller than 14px anywhere, buttons and inputs 18px, headings 40-48 / 30-34 / 22-24px. Friendly sans-serif (Inter or Plus Jakarta Sans). Prices bold.
- Touch targets at least 48px. Rounded corners 12-24px. Soft shadows. Generous white space.
- SIMPLE: one primary button per screen, at most 6 items in the header (Movies, Cinemas, My Tickets, city, search, Sign in), extras (snacks, coupons, technical details) collapsed by default. Plain language, Indian English, prices in rupees with a rupee sign (for example "Rs 250" shown as ₹250), 12-hour times.
- Seat states must be understandable without colour alone: Available (white with a coloured border), Yours (solid crimson with a tick), Held by someone else (amber with a clock), Taken (grey with a cross). Categories: Front, Prime, Premier with distinct colours and prices.
- Responsive: design phone (390px) first, then tablet and desktop. Accessible: visible focus rings, labels on every control.
- Use only invented placeholder movies, cinemas and images. No real brands, no copyrighted artwork.

Deliver each screen as a polished, interactive web prototype with realistic fake data, then list the design tokens and components you used.
```

## Step 2: design the screens, one prompt each (paste after the brief)

**2.1 Home**
```
Design the Home page. A hero showing the "movie of the day" on a rich colour gradient with two buttons (Book tickets, Watch trailer), then only three rows: Now showing, Coming soon, Offers. Movie cards: poster, title, language, rating, duration, a Book button always visible. One search box. Footer with policies. Give me 3 different layout options for the hero so I can compare.
```
**2.2 Movie details + showtimes**
```
Design the Movie page: colourful header with poster, title, certificate, rating, language and format chips, buttons Book tickets and Watch trailer, a tab bar (About, Cast, Reviews), and a showtimes section with a 7-day date strip, filters (language, format, time of day) and cinemas listed with showtime chips. Chips show price range and availability (Available, Fast filling, Almost full, Sold out) using colour AND text. The trailer opens in a large, simple player modal with captions and quality options. Make it clear and uncluttered.
```
**2.3 Seat selection (the most important screen)**
```
Design the Seat selection page. Top: a 3-step progress bar (Show, Seats, Pay) and a calm hold timer ("Seats held for 4:32"). Centre: a large, easy 2D seat map for a 10-row, 10-seat-per-row auditorium (rows A to J, Front rows A-C Rs150, Prime D-G Rs250, Premier H-J Rs350), a central aisle between seat 5 and 6, a "Screen this way" curve at the top, seat 01 on the LEFT, and a simple legend. On hover or tap each seat shows a tooltip with seat label, price (large, bold), category and status. Right side on desktop, bottom bar on phone: movie, cinema, time, selected seats, total, and one big Continue button. Include a friendly "Pick the best seats for me" shortcut and a clear secondary button "See it in 3D". Provide a collapsed section "Add snacks" and "Have a coupon?". Show states: empty selection, 2 seats selected, a seat just taken by someone else (friendly message), hold expired.
```
**2.4 3D theatre overlay (visual only)**
```
Design ONLY the interface overlay for a full-screen 3D theatre view (use a placeholder photo of a cinema hall as the background). Minimal: back button, a simple mode switch (Look around, Walk, Sit), a one-line controls hint, a large price tooltip that follows the pointer over a seat, a bottom bar with selected seats, total and Continue, trailer play/pause and mute controls, and one settings gear. No yellow boxes or heavy panels; details open from a single Details button. Show desktop and phone layouts.
```
**2.5 Add-ons, review and pay**
```
Design steps 2 and 3: optional snacks (large cards with images and quantity steppers, easy Skip), then Review and Pay with an order summary, optional coupon, contact details, cancellation policy in plain words, and one big Pay button. Show the processing, success and failed-payment states.
```
**2.6 Ticket, My Tickets, Profile**
```
Design the digital ticket (large QR code, booking ID, movie, cinema, screen, time, seats, buttons Add to calendar, Download, Share), a My Tickets page (Upcoming, Past, Cancelled) and a simple Profile page. Make the ticket readable at arm's length on a phone.
```
**2.7 Cinemas, search, empty and error states**
```
Design the Cinemas list and a Cinema page, the search results page, a friendly empty state, a "something went wrong" page and a loading skeleton. Keep them consistent with the rest.
```

## Step 3: enhancement rounds (use after each screen)
```
Review your design against my hard rules. List every place where text is below 14px, body text below 18px, contrast below 4.5:1, a touch target below 48px, more than one primary button on a screen, or anything a first-time user could find confusing. Then fix them and show the improved version.
```
```
Simplify this screen: remove or hide 30 percent of the elements without losing the ability to complete the task. Say what you removed and why.
```
```
Make it richer without making it busier: improve the colour, imagery, spacing and micro-interactions (hover, press, focus, loading) while keeping contrast and simplicity. Show 2 alternatives.
```
```
Test it as a first-time user: write the steps needed to book 2 seats from the home page and count the clicks. Suggest changes so it takes 4 clicks or fewer to reach seat selection.
```

## Step 4: what to collect for Antigravity
1. Screenshots of your chosen version of each screen at 390px (phone), 768px and 1280px, saved as `docs/design/<screen>-390.png` etc. in the repo.
2. A text file `docs/design/tokens.md` with the final colours, font family and sizes, spacing, radii, shadows and the component list (ask AI Studio: "List all design tokens and components you used in the final design").
3. A short `docs/design/notes.md` listing what you liked, what to avoid, and any copy (headings, button texts) you want kept.
4. Do not commit AI Studio's generated code to the main repo. If you want to keep it, put it in a `design-prototypes/` folder that is excluded from the build.

## Step 5: hand over to Antigravity (paste in a NEW session)
```
Read DESIGN_SPEC.md, phases/phase-2c-simple-light-ui.md, SECURITY_SPEC.md and everything in docs/design/ (screenshots, tokens.md, notes.md). The screenshots are the approved visual direction for CineVerse, made as a prototype. Rebuild these screens in our Next.js + Tailwind + shadcn/ui app using our existing components, routing, data and security rules. Do not copy prototype code. Where the screenshots and DESIGN_SPEC.md disagree, the screenshots win on look and feel, but DESIGN_SPEC.md wins on accessibility numbers (18px body, nothing under 14px, 48px touch targets, 4.5:1 contrast) and on the simplicity budget.

Do it in this order, one commit per screen, and stop after the seat selection screen for my review: tokens and global shell, Home, Movie page with showtimes and trailer modal, Seat selection (2D map first, "See it in 3D" button secondary, hover price tooltips, shared selection with the 3D view), 3D overlay, Add-ons and Review and Pay, Ticket and My Tickets, Cinemas and search, empty and error states.

For each screen give me: before/after screenshots at 390, 768 and 1280 widths next to the approved design, a list of differences from the design with reasons, the automated checks (no text under 14px, axe contrast, one primary button, click count), and confirmation that all earlier tests still pass. Keep all existing behaviour: seat numbering (seat 01 on the audience's left, map by node_name), server-calculated prices, security headers and booking rules. If a design element would break an accessibility or security rule, change it and tell me.
```

## Tips
- Generate 2 or 3 versions of the seat selection page and the home hero; choose by asking five friends or family to book a ticket without help and watch where they hesitate.
- AI-generated designs often look great in one state and fall apart in others. Always ask for the error, empty, loading and sold-out states.
- Keep a record of the prompt that produced the final design so you can reproduce or adjust it.
