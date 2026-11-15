// frontend/services/api.ts
// Complete API client for CineVerse FastAPI backend.

const API_BASE = '/api/v1';

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('cineverse_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorDetail = response.statusText;
      let retryAfter: number | null = null;
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errJson.error?.message || JSON.stringify(errJson);
        if (errJson.error?.retry_after) {
          retryAfter = Number(errJson.error.retry_after);
        }
      } catch {
        // ignore
      }
      const rawHeader = response.headers.get('Retry-After');
      if (rawHeader) {
        const parsed = Number(rawHeader);
        if (!isNaN(parsed)) retryAfter = parsed;
      }
      if (response.status === 429) {
        const waitMsg = retryAfter ? ` Please wait ${retryAfter} seconds before trying again.` : ' Please wait a moment before trying again.';
        errorDetail = `Too many requests.${waitMsg}`;
      }
      const err = new Error(errorDetail || `API request failed with status ${response.status}`);
      (err as any).status = response.status;
      (err as any).retryAfter = retryAfter;
      throw err;
    }

    return response.json();
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch')) {
      const netErr = new Error('Network error. Unable to reach authentication server.');
      (netErr as any).status = 0;
      throw netErr;
    }
    throw err;
  }
}

// ---------------- CITIES ----------------
export interface City {
  id: number;
  name: string;
  slug: string;
  state: string;
  is_active: boolean;
}

export async function getCities(): Promise<City[]> {
  return apiFetch<City[]>('/cities/');
}

// ---------------- TECHNICAL SPECIFICATIONS ----------------
export interface ScreenFormatItem {
  id: number;
  name: string;
  description?: string;
  requires_glasses: boolean;
  is_active: boolean;
}

export interface SoundSystemItem {
  id: number;
  name: string;
  description?: string;
  channels?: string;
  is_active: boolean;
}

export interface ProjectionTypeItem {
  id: number;
  name: string;
  description?: string;
  resolution?: string;
  is_active: boolean;
}

export interface FilterFacetCount {
  name: string;
  count: number;
  requires_glasses?: boolean;
  channels?: string;
  resolution?: string;
}

export interface FilterFacetsResponse {
  city_id?: number | null;
  movie_id?: number | null;
  cinema_id?: number | null;
  total_auditoriums: number;
  formats: FilterFacetCount[];
  sounds: FilterFacetCount[];
  projections: FilterFacetCount[];
}

export async function getFilterFacets(cityId?: number, movieId?: number, cinemaId?: number): Promise<FilterFacetsResponse> {
  const query = new URLSearchParams();
  if (cityId) query.set('city_id', cityId.toString());
  if (movieId) query.set('movie_id', movieId.toString());
  if (cinemaId) query.set('cinema_id', cinemaId.toString());
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<FilterFacetsResponse>(`/technical-specs/facets${qs}`);
}

export async function getScreenFormats(): Promise<ScreenFormatItem[]> {
  return apiFetch<ScreenFormatItem[]>('/technical-specs/formats');
}

export async function getSoundSystems(): Promise<SoundSystemItem[]> {
  return apiFetch<SoundSystemItem[]>('/technical-specs/sounds');
}

export async function getProjectionTypes(): Promise<ProjectionTypeItem[]> {
  return apiFetch<ProjectionTypeItem[]>('/technical-specs/projections');
}

export interface AuditoriumDetail {
  id: number;
  cinema_id: number;
  name: string;
  screen_type: string;
  total_seats: number;
  has_3d_preview: boolean;
  layout_data?: any;
  glb_path?: string;
  layout_path?: string;
  screen_format_id?: number;
  sound_system_id?: number;
  projection_type_id?: number;
  screen_format_name?: string;
  sound_system_name?: string;
  projection_type_name?: string;
  tech_specs_display?: string;
  requires_glasses?: boolean;
  confirmed_with_cinema?: boolean;
  is_demo?: boolean;
}

export async function getAuditorium(auditoriumId: number | string): Promise<AuditoriumDetail> {
  return apiFetch<AuditoriumDetail>(`/auditoriums/${auditoriumId}`);
}

// ---------------- MOVIES ----------------
export interface Movie {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  poster_url: string;
  banner_url: string;
  trailer_url?: string;
  dominant_color?: string | null;
  glimpse_url?: string | null;
  glimpse_webm_url?: string | null;
  glimpse_720p_url?: string | null;
  duration_minutes: number;
  certificate: string;
  release_date: string;
  is_now_showing: boolean;
  is_coming_soon: boolean;
  rating_avg: number;
  rating_count: number;
  interested_count: number;
  languages: string[];
  genres: string[];
  formats: string[];
  tmdb_id?: number;
  tmdb_vote_average?: number;
  is_tmdb?: boolean;
  youtube_trailer_id?: string;
}

export interface CastMember {
  id: number;
  person_name: string;
  role_name: string;
  photo_url?: string;
  category: string;
}

export interface Review {
  id: number;
  movie_id: number;
  user_id: number;
  rating: number;
  headline: string;
  content: string;
  has_spoilers: boolean;
  created_at: string;
  user_name: string;
}

export interface MovieDetail extends Movie {
  cast_members: CastMember[];
  reviews: Review[];
}

export async function getMovies(params: {
  city_id?: number;
  genre?: string;
  language?: string;
  format?: string;
  sound?: string;
  projection?: string;
  certificate?: string;
  status?: 'now_showing' | 'coming_soon';
  search?: string;
  sort?: 'popularity' | 'rating' | 'release_date' | 'title';
  page?: number;
  page_size?: number;
} = {}): Promise<Movie[]> {
  const query = new URLSearchParams();
  const cId = params.city_id || (typeof window !== 'undefined' ? parseInt(localStorage.getItem('cineverse_city_id') || '1', 10) : 1);
  if (cId) query.set('city_id', cId.toString());
  if (params.genre) query.set('genre', params.genre);
  if (params.language) query.set('language', params.language);
  if (params.format) query.set('format', params.format);
  if (params.sound) query.set('sound', params.sound);
  if (params.projection) query.set('projection', params.projection);
  if (params.certificate) query.set('certificate', params.certificate);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', params.page.toString());
  if (params.page_size) query.set('page_size', params.page_size.toString());

  return apiFetch<Movie[]>(`/movies?${query.toString()}`);
}

export async function getMovie(idOrSlug: string | number): Promise<MovieDetail> {
  return apiFetch<MovieDetail>(`/movies/${idOrSlug}`);
}

export interface ShowtimeSlot {
  id: number;
  movie_id: number;
  auditorium_id: number;
  auditorium_name: string;
  screen_type: string;
  screen_format?: string;
  sound_system?: string;
  projection_type?: string;
  tech_specs_display?: string;
  requires_glasses?: boolean;
  confirmed_with_cinema?: boolean;
  is_demo?: boolean;
  has_3d_preview: boolean;
  start_time: string;
  end_time: string;
  format: string;
  language: string;
  lowest_price: number;
  availability_status: 'AVAILABLE' | 'FAST_FILLING' | 'ALMOST_FULL' | 'SOLD_OUT';
  available_seat_count: number;
  total_seat_count: number;
}

export interface CinemaShowtimesGroup {
  cinema_id: number;
  cinema_name: string;
  slug?: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
  landmark?: string | null;
  parking?: string | null;
  transit_stop?: string | null;
  phone?: string | null;
  opening_hours?: string | null;
  distance_km?: number | null;
  directions_url?: string | null;
  cancellation_policy: string;
  facilities: string[];
  showtimes: ShowtimeSlot[];
}

export async function getMovieShowtimes(
  movieId: number,
  cityId?: number,
  targetDate?: string,
  format?: string,
  language?: string,
  userLat?: number,
  userLng?: number,
  maxDistanceKm?: number,
  sound?: string,
  projection?: string
): Promise<CinemaShowtimesGroup[]> {
  const query = new URLSearchParams();
  const cId = cityId || (typeof window !== 'undefined' ? parseInt(localStorage.getItem('cineverse_city_id') || '1', 10) : 1);
  if (cId) query.set('city_id', cId.toString());
  if (targetDate) query.set('target_date', targetDate);
  if (format) query.set('format', format);
  if (sound) query.set('sound', sound);
  if (projection) query.set('projection', projection);
  if (language) query.set('language', language);
  if (userLat != null) query.set('user_lat', userLat.toString());
  if (userLng != null) query.set('user_lng', userLng.toString());
  if (maxDistanceKm != null) query.set('max_distance_km', maxDistanceKm.toString());

  return apiFetch<CinemaShowtimesGroup[]>(`/movies/${movieId}/showtimes?${query.toString()}`);
}

// ---------------- CINEMAS ----------------
export interface Cinema {
  id: number;
  city_id: number;
  name: string;
  slug: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
  landmark?: string | null;
  parking?: string | null;
  transit_stop?: string | null;
  phone?: string | null;
  opening_hours?: string | null;
  is_demo_data?: boolean;
  distance_km?: number | null;
  directions_url?: string | null;
  cancellation_policy: string;
  facilities: string[];
  images: string[];
}

export async function getCinemas(params: {
  cityId?: number;
  search?: string;
  format?: string;
  sound?: string;
  projection?: string;
  userLat?: number;
  userLng?: number;
  maxDistanceKm?: number;
  sortBy?: 'distance' | 'name';
} | number = {}): Promise<Cinema[]> {
  const query = new URLSearchParams();
  if (typeof params === 'number') {
    query.set('city_id', params.toString());
  } else {
    const cId = params.cityId || (typeof window !== 'undefined' ? parseInt(localStorage.getItem('cineverse_city_id') || '1', 10) : 1);
    if (cId) query.set('city_id', cId.toString());
    if (params.search) query.set('search', params.search);
    if (params.format) query.set('format', params.format);
    if (params.sound) query.set('sound', params.sound);
    if (params.projection) query.set('projection', params.projection);
    if (params.userLat != null) query.set('user_lat', params.userLat.toString());
    if (params.userLng != null) query.set('user_lng', params.userLng.toString());
    if (params.maxDistanceKm != null) query.set('max_distance_km', params.maxDistanceKm.toString());
    if (params.sortBy) query.set('sort_by', params.sortBy);
  }
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<Cinema[]>(`/cinemas/${queryString}`);
}

export async function getCinema(idOrSlug: string | number): Promise<Cinema> {
  return apiFetch<Cinema>(`/cinemas/${idOrSlug}`);
}

export interface CinemaMovieShowtimes {
  movie_id: number;
  title: string;
  slug: string;
  poster_url: string;
  certificate: string;
  duration_minutes: number;
  languages: string[];
  formats: string[];
  showtimes: ShowtimeSlot[];
}

export async function getCinemaShowtimes(
  cinemaId: number,
  targetDate?: string,
  format?: string,
  sound?: string,
  projection?: string
): Promise<CinemaMovieShowtimes[]> {
  const query = new URLSearchParams();
  if (targetDate) query.set('target_date', targetDate);
  if (format) query.set('format', format);
  if (sound) query.set('sound', sound);
  if (projection) query.set('projection', projection);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<CinemaMovieShowtimes[]>(`/cinemas/${cinemaId}/showtimes${qs}`);
}

// ---------------- GLOBAL SEARCH ----------------
export interface SearchResult {
  query: string;
  total_results: number;
  movies: Movie[];
  cinemas: Cinema[];
}

export async function globalSearch(query: string, limit = 10): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/search/?q=${encodeURIComponent(query)}&limit=${limit}`);
}

// ---------------- SHOWTIME SEATS ----------------
export interface TierSummaryItem {
  name: string;
  category: string;
  price: number;
  currency: string;
  rows: string[];
  color?: string;
}

export interface SeatInventoryItem {
  seat_id: string;
  category: string;
  price: number;
  currency?: string;
  quote_id?: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'PAYMENT_PENDING';
  held_by_current_user: boolean;
  row: string;
  number: number;
  node_name: string;
  distance_to_screen: number;
  vertical_angle_deg: number;
  horizontal_angle_deg: number;
  is_accessible?: boolean;
}

export interface CategoryBand {
  category: string;
  rows: string[];
  price_multiplier?: number;
}

export interface AuditoriumLayoutData {
  rows: string[];
  seats_per_row: number;
  aisles: number[];
  accessible_seats?: string[];
  companion_seats?: string[];
  category_bands?: CategoryBand[];
  recliner_pairs?: [string, string][];
  curve_radius?: number;
  angle_span?: number;
  levels?: { balcony?: any; stalls?: any } | any;
  has_balcony?: boolean;
  [key: string]: any;
}

export interface ShowtimeSeatsResponse {
  showtime_id: number;
  movie_id: number;
  movie_title: string;
  cinema_id: number;
  cinema_name: string;
  auditorium_id: number;
  auditorium_name: string;
  screen_type: string;
  screen_format?: string;
  sound_system?: string;
  projection_type?: string;
  tech_specs_display?: string;
  requires_glasses?: boolean;
  confirmed_with_cinema?: boolean;
  is_demo?: boolean;
  has_3d_preview: boolean;
  layout_data?: AuditoriumLayoutData | null;
  format: string;
  language: string;
  start_time: string;
  currency?: string;
  quote_id?: string;
  glb_path: string;
  layout_path: string;
  trailer_url?: string;
  poster_url?: string;
  banner_url?: string;
  dominant_color?: string | null;
  glimpse_url?: string | null;
  glimpse_webm_url?: string | null;
  glimpse_720p_url?: string | null;
  tiers?: TierSummaryItem[];
  seats: SeatInventoryItem[];
}

export async function getShowtimeSeats(showtimeId: number | string): Promise<ShowtimeSeatsResponse> {
  return apiFetch<ShowtimeSeatsResponse>(`/showtimes/${showtimeId}/seats`);
}

// ---------------- HOLDS & BOOKINGS ----------------
export interface SeatHoldResponse {
  hold_id: string;
  showtime_id: number;
  held_seats: string[];
  expires_at: string;
  hold_duration_seconds: number;
  message: string;
}

export async function holdSeats(
  showtimeId: number,
  seatIds: string[],
  idempotencyKey?: string
): Promise<SeatHoldResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }
  return apiFetch<SeatHoldResponse>(`/bookings/hold?showtime_id=${showtimeId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ seat_ids: seatIds, idempotency_key: idempotencyKey }),
  });
}

export async function releaseSeats(holdId: string, seatIds?: string[]): Promise<{ released: string[] }> {
  return apiFetch<{ released: string[] }>('/bookings/release', {
    method: 'POST',
    body: JSON.stringify({ hold_id: holdId, seat_ids: seatIds }),
  });
}

export async function extendHold(holdId: string): Promise<{ hold_id: string; new_expires_at: string }> {
  return apiFetch<{ hold_id: string; new_expires_at: string }>('/bookings/extend', {
    method: 'POST',
    body: JSON.stringify({ hold_id: holdId }),
  });
}

export interface FnbItem {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url?: string;
  is_available: boolean;
}

export async function getFnbAddons(cinemaId?: number): Promise<FnbItem[]> {
  const q = cinemaId ? `?cinema_id=${cinemaId}` : '';
  return apiFetch<FnbItem[]>(`/addons/${q}`);
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  discount_amount: number;
  message: string;
}

export async function validateCoupon(code: string, orderAmount: number): Promise<CouponValidation> {
  return apiFetch<CouponValidation>('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, order_amount: orderAmount }),
  });
}

export interface RefundBreakdownPaise {
  ticket_amount_paise: number;
  ticket_refund_paise: number;
  addons_amount_paise: number;
  addons_refund_paise: number;
  convenience_fee_paise: number;
  convenience_fee_refund_paise: number;
  gst_amount_paise: number;
  gst_refund_paise: number;
  discount_amount_paise: number;
  cancellation_fee_paise: number;
  total_paid_paise: number;
  total_refund_paise: number;
  ticket_amount_display: string;
  ticket_refund_display: string;
  addons_amount_display: string;
  addons_refund_display: string;
  convenience_fee_display: string;
  gst_amount_display: string;
  cancellation_fee_display: string;
  total_paid_display: string;
  total_refund_display: string;
}

export interface RefundTimelineItem {
  status: 'REQUESTED' | 'PROCESSING' | 'REFUNDED' | 'FAILED' | string;
  timestamp: string;
  note: string;
}

export interface RefundResponse {
  id: number;
  booking_id: number;
  payment_id?: number | null;
  refund_amount: number;
  cancellation_fee: number;
  amount_paise: number;
  amount_display: string;
  cancellation_fee_paise: number;
  cancellation_fee_display: string;
  status: 'REQUESTED' | 'PROCESSING' | 'REFUNDED' | 'FAILED' | string;
  timeline: RefundTimelineItem[];
  is_stuck: boolean;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CancellationQuoteResponse {
  booking_id: number;
  booking_code: string;
  can_cancel: boolean;
  cancellation_cutoff_minutes: number;
  cutoff_time: string;
  is_late: boolean;
  is_used: boolean;
  reason_ineligible?: string | null;
  policy_text: string;
  breakdown: RefundBreakdownPaise;
}

export interface BookingResponse {
  id: number;
  booking_code: string;
  showtime_id: number;
  movie_id?: number | null;
  movie_title: string;
  movie_poster_url: string;
  movie_banner_url?: string | null;
  movie_dominant_color?: string | null;
  movie_glimpse_url?: string | null;
  movie_glimpse_webm_url?: string | null;
  movie_glimpse_720p_url?: string | null;
  cinema_name: string;
  cinema_address: string;
  cinema_latitude?: number | null;
  cinema_longitude?: number | null;
  cinema_pincode?: string | null;
  cinema_landmark?: string | null;
  cinema_parking?: string | null;
  cinema_transit_stop?: string | null;
  directions_url?: string | null;
  auditorium_name: string;
  screen_type: string;
  screen_format?: string;
  sound_system?: string;
  projection_type?: string;
  tech_specs_display?: string;
  requires_glasses?: boolean;
  confirmed_with_cinema?: boolean;
  is_demo?: boolean;
  start_time: string;
  seats: { seat_id: string; category: string; price: number }[];
  addons: { fnb_item_id: number; name: string; quantity: number; unit_price: number; total_price: number }[];
  total_ticket_amount: number;
  convenience_fee: number;
  gst_amount: number;
  addons_amount: number;
  discount_amount: number;
  final_total_amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  ticket?: {
    ticket_number: string;
    qr_data: string;
    qr_code_url: string;
    hmac_signature: string;
    issued_at: string;
    is_used?: boolean;
    used_at?: string | null;
  };
  can_cancel?: boolean;
  cancellation_policy?: string | null;
  cancellation_cutoff_time?: string | null;
  refund_breakdown?: RefundBreakdownPaise | null;
  refund?: RefundResponse | null;
}

export interface HoldSeatQuote {
  seat_id: string;
  category: string;
  price: number;
  price_display: string;
}

export interface HoldAddonQuote {
  fnb_item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  unit_price_display: string;
  line_total: number;
  line_total_display: string;
}

export interface HoldCouponQuote {
  code: string;
  discount_amount: number;
  discount_amount_display: string;
  message?: string;
}

export interface HoldQuoteResponse {
  hold_id: string;
  showtime_id: number;
  movie_id?: number | null;
  movie_title: string;
  movie_poster_url: string;
  movie_banner_url?: string | null;
  movie_dominant_color?: string | null;
  movie_glimpse_url?: string | null;
  movie_glimpse_webm_url?: string | null;
  movie_glimpse_720p_url?: string | null;
  cinema_name: string;
  cinema_address: string;
  cinema_latitude?: number | null;
  cinema_longitude?: number | null;
  cinema_pincode?: string | null;
  cinema_landmark?: string | null;
  cinema_parking?: string | null;
  cinema_transit_stop?: string | null;
  directions_url?: string | null;
  auditorium_name: string;
  screen_type: string;
  screen_format?: string;
  sound_system?: string;
  projection_type?: string;
  tech_specs_display?: string;
  requires_glasses?: boolean;
  confirmed_with_cinema?: boolean;
  is_demo?: boolean;
  start_time: string;
  expires_at: string;
  hold_duration_seconds: number;
  held_seats: HoldSeatQuote[];
  ticket_subtotal: number;
  ticket_subtotal_display: string;
  convenience_fee: number;
  convenience_fee_display: string;
  gst_amount: number;
  gst_amount_display: string;
  addons: HoldAddonQuote[];
  addons_subtotal: number;
  addons_subtotal_display: string;
  applied_coupon: HoldCouponQuote | null;
  discount_amount: number;
  discount_amount_display: string;
  final_total: number;
  final_total_display: string;
  price_lock_guarantee: string;
}

export async function getHoldQuote(holdId: string): Promise<HoldQuoteResponse> {
  return apiFetch<HoldQuoteResponse>(`/bookings/hold/${holdId}`);
}

export async function updateHoldAddons(
  holdId: string,
  addons: { fnb_item_id: number; quantity: number }[]
): Promise<HoldQuoteResponse> {
  return apiFetch<HoldQuoteResponse>(`/bookings/hold/${holdId}/addons`, {
    method: 'POST',
    body: JSON.stringify({ addons }),
  });
}

export async function applyHoldCoupon(holdId: string, code: string): Promise<HoldQuoteResponse> {
  return apiFetch<HoldQuoteResponse>(`/bookings/hold/${holdId}/coupon`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function createBooking(data: {
  hold_id: string;
  contact_email: string;
  contact_phone: string;
  showtime_id?: number;
  seat_ids?: string[];
  addons?: { fnb_item_id: number; quantity: number }[];
  coupon_code?: string;
}): Promise<BookingResponse> {
  return apiFetch<BookingResponse>('/bookings/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getBooking(id: number | string): Promise<BookingResponse> {
  return apiFetch<BookingResponse>(`/bookings/${id}`);
}

export async function getCancellationQuote(id: number | string): Promise<CancellationQuoteResponse> {
  return apiFetch<CancellationQuoteResponse>(`/bookings/${id}/cancellation-quote`);
}

export async function cancelBooking(id: number | string): Promise<{
  booking_id: number;
  status: string;
  refund_amount: number;
  amount_paise: number;
  cancellation_fee: number;
  cancellation_fee_paise: number;
  timeline: RefundTimelineItem[];
  breakdown?: RefundBreakdownPaise;
  message: string;
  already_cancelled?: boolean;
}> {
  return apiFetch(`/bookings/${id}/cancel`, { method: 'POST' });
}

export async function getStuckRefunds(): Promise<any[]> {
  return apiFetch<any[]>('/admin/refunds/stuck');
}

export async function retryStuckRefund(id: number | string): Promise<any> {
  return apiFetch<any>(`/admin/refunds/${id}/retry`, { method: 'POST' });
}

export async function getMyBookings(): Promise<BookingResponse[]> {
  return apiFetch<BookingResponse[]>('/bookings/user/my-bookings');
}

// ---------------- PAYMENTS ----------------
export interface RazorpayOrder {
  order_id: string;
  booking_id: number;
  amount: number;
  currency: string;
  key_id: string;
  name: string;
  description: string;
}

export async function createRazorpayOrder(bookingId: number): Promise<RazorpayOrder> {
  return apiFetch<RazorpayOrder>('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId }),
  });
}

export async function verifyPayment(data: {
  booking_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<BookingResponse> {
  return apiFetch<BookingResponse>('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---------------- AUTH ----------------
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: number;
  role: string;
  full_name: string;
}

export async function loginUser(emailOrPhone: string, password: string): Promise<TokenResponse> {
  const isEmail = emailOrPhone.includes('@');
  const payload = isEmail
    ? { email: emailOrPhone, password }
    : { phone: emailOrPhone, password };

  const res = await apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.access_token && typeof window !== 'undefined') {
    localStorage.setItem('cineverse_token', res.access_token);
    localStorage.setItem('cineverse_user', JSON.stringify(res));
  }
  return res;
}

export async function registerUser(data: {
  email?: string;
  phone?: string;
  password: string;
  full_name: string;
}): Promise<TokenResponse> {
  const res = await apiFetch<TokenResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (res.access_token && typeof window !== 'undefined') {
    localStorage.setItem('cineverse_token', res.access_token);
    localStorage.setItem('cineverse_user', JSON.stringify(res));
  }
  return res;
}

export async function sendOtp(phone: string): Promise<{ message: string }> {
  return apiFetch('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, otp: string): Promise<TokenResponse> {
  const res = await apiFetch<TokenResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
  if (res.access_token && typeof window !== 'undefined') {
    localStorage.setItem('cineverse_token', res.access_token);
    localStorage.setItem('cineverse_user', JSON.stringify(res));
  }
  return res;
}

export async function logoutUser(): Promise<void> {
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
    });
  } catch {
    // Ignore server error on logout to ensure client cleanup proceeds
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cineverse_token');
      localStorage.removeItem('cineverse_user');
    }
  }
}

export async function refreshToken(providedRefreshToken?: string): Promise<TokenResponse> {
  const res = await apiFetch<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(providedRefreshToken ? { refresh_token: providedRefreshToken } : {}),
  });
  if (res.access_token && typeof window !== 'undefined') {
    localStorage.setItem('cineverse_token', res.access_token);
    localStorage.setItem('cineverse_user', JSON.stringify(res));
  }
  return res;
}

export async function forgotPassword(emailOrPhone: string): Promise<{ message: string; hint?: string }> {
  const isEmail = emailOrPhone.includes('@');
  const payload = isEmail ? { email: emailOrPhone } : { phone: emailOrPhone };
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(data: { emailOrPhone: string; tokenOrOtp: string; newPassword: string }): Promise<{ message: string }> {
  const isEmail = data.emailOrPhone.includes('@');
  const payload: any = {
    new_password: data.newPassword,
    token: data.tokenOrOtp,
  };
  if (isEmail) {
    payload.email = data.emailOrPhone;
  } else {
    payload.phone = data.emailOrPhone;
  }
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(): Promise<any> {
  return apiFetch('/auth/me');
}

export function getStoredUser(): TokenResponse | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('cineverse_user');
  return user ? JSON.parse(user) : null;
}

// ---------------- ADMIN ----------------
export interface AdminAnalytics {
  total_revenue: number;
  total_bookings: number;
  total_tickets_sold: number;
  overall_occupancy_percentage: number;
  top_movies: { title: string; bookings: number; revenue: number }[];
  recent_bookings: {
    id: number;
    booking_code: string;
    movie: string;
    amount: number;
    seats_count: number;
    created_at: string;
  }[];
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  return apiFetch<AdminAnalytics>('/admin/analytics');
}

// ---------------- VOICE AGENT (PHASE 9) ----------------
export interface AgentUIAction {
  action: string;
  params: Record<string, any>;
}

export interface AgentConfirmationCard {
  card_type: string;
  title: string;
  description: string;
  details: Record<string, any>;
  requires_tap_confirmation: boolean;
  action_token: string;
  expires_at?: string;
}

export interface AgentMessageResponse {
  session_id: string;
  reply_text: string;
  language: string;
  ui_actions: AgentUIAction[];
  confirmation_card?: AgentConfirmationCard;
  spoken_audio_url?: string;
  tool_calls_made: Record<string, any>[];
}

export async function createAgentSession(language: string = 'en'): Promise<{ session_id: string; welcome_message: string; language: string }> {
  return apiFetch('/agent/session', {
    method: 'POST',
    body: JSON.stringify({ language }),
  });
}

export async function sendAgentMessage(
  sessionId: string,
  message: string,
  language: string = 'en',
  clientContext?: Record<string, any>
): Promise<AgentMessageResponse> {
  return apiFetch<AgentMessageResponse>('/agent/message', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      message,
      language,
      client_context: clientContext || {},
    }),
  });
}

export async function confirmAgentAction(
  sessionId: string,
  actionToken: string,
  cardType: string,
  parameters: Record<string, any> = {}
): Promise<{ status: string; message: string; hold_id?: string; refund_amount?: number }> {
  return apiFetch('/agent/confirm-action', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      action_token: actionToken,
      card_type: cardType,
      parameters,
    }),
  });
}

// ---------------- PHASE 12: OPERATIONS & ONBOARDING ----------------

export interface StaffScanResponse {
  result: 'SUCCESS' | 'ALREADY_USED' | 'INVALID_TICKET' | 'SHOWTIME_MISMATCH';
  ticket_number: string;
  booking_code: string;
  movie_title: string;
  screen_name: string;
  start_time: string;
  seats: string[];
  total_admissions: number;
  scanned_at: string;
}

export async function registerStaffDevice(gate: string, deviceName: string) {
  return apiFetch<{ device_id: string; device_name: string; gate: string }>('/staff/devices/register', {
    method: 'POST',
    body: JSON.stringify({ gate, device_name: deviceName }),
  });
}

export async function scanTicket(qrData: string, gate: string = 'Gate 1', deviceId?: string): Promise<StaffScanResponse> {
  return apiFetch<StaffScanResponse>('/staff/scan', {
    method: 'POST',
    body: JSON.stringify({ qr_data: qrData, gate, device_id: deviceId }),
  });
}

export async function lookupTicket(code: string) {
  return apiFetch<any>(`/staff/lookup?code=${encodeURIComponent(code)}`);
}

export async function validateGLB(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const token = typeof window !== 'undefined' ? localStorage.getItem('cineverse_token') : null;
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/admin/onboarding/validate-glb`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'GLB validation failed');
  }
  return res.json();
}

export async function publishTheatreAsset(auditoriumId: number, versionLabel: string, seatLayout: any) {
  const formData = new FormData();
  formData.append('version_label', versionLabel);
  formData.append('seat_layout_json', JSON.stringify(seatLayout));
  const token = typeof window !== 'undefined' ? localStorage.getItem('cineverse_token') : null;
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/admin/onboarding/publish?auditorium_id=${auditoriumId}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Publish failed');
  }
  return res.json();
}

export async function getAssetVersions(auditoriumId: number) {
  return apiFetch<{ auditorium_id: number; versions: any[] }>(`/admin/onboarding/versions/${auditoriumId}`);
}

export async function rollbackAssetVersion(auditoriumId: number, targetVersionId: number) {
  return apiFetch<any>(`/admin/onboarding/rollback?auditorium_id=${auditoriumId}&target_version_id=${targetVersionId}`, {
    method: 'POST',
  });
}

export async function optimizeTheatreAsset(auditoriumId: number) {
  return apiFetch<any>(`/admin/onboarding/optimize?auditorium_id=${auditoriumId}`, {
    method: 'POST',
  });
}

export async function getKdsOrders() {
  return apiFetch<{ orders: any[] }>('/food/kds/orders');
}

export async function updateKdsOrderStatus(orderId: number, status: string) {
  return apiFetch<any>(`/food/kds/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getLoyaltyAccount() {
  return apiFetch<any>('/loyalty/account');
}

export async function subscribeCinePass() {
  return apiFetch<any>('/loyalty/cinepass/subscribe', { method: 'POST' });
}

export async function cancelCinePass() {
  return apiFetch<any>('/loyalty/cinepass/cancel', { method: 'POST' });
}

export async function claimReferral(referralCode: string) {
  return apiFetch<any>('/loyalty/referral/claim', {
    method: 'POST',
    body: JSON.stringify({ referral_code: referralCode }),
  });
}

export async function transferTicket(ticketId: number, recipientEmail: string) {
  return apiFetch<any>(`/tickets/${ticketId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ recipient_email: recipientEmail }),
  });
}

// ---------------- ADMIN SECURITY & ANTI-BOT ----------------
export interface SecurityMetrics {
  global_counters: Record<string, number>;
  active_blocks_count: number;
  blocked_targets: Array<{
    target_type: string;
    target: string;
    masked_target: string;
    reason: string;
    ttl_seconds: number;
    expires_in_minutes: number;
  }>;
  recent_alerts: Array<{
    id: string;
    severity: string;
    reason: string;
    client_ip: string;
    masked_ip: string;
    user_id: number | null;
    timestamp: number;
    status: string;
  }>;
  recent_events: Array<{
    event_type: string;
    masked_ip: string;
    user_id: number | null;
    timestamp: number;
    metadata: Record<string, any>;
  }>;
}

export async function getSecurityMetrics(): Promise<SecurityMetrics> {
  return apiFetch<SecurityMetrics>('/admin/security/metrics');
}

export async function blockSecurityTarget(target_type: 'ip' | 'user', target: string, duration_minutes: number, reason: string) {
  return apiFetch<any>('/admin/security/block', {
    method: 'POST',
    body: JSON.stringify({ target_type, target, duration_minutes, reason }),
  });
}

export async function unblockSecurityTarget(target_type: 'ip' | 'user', target: string) {
  return apiFetch<any>('/admin/security/unblock', {
    method: 'POST',
    body: JSON.stringify({ target_type, target }),
  });
}

// ---------------- OPERATOR SCHEDULING & PRICING ----------------
export interface OperatorCinema {
  id: number;
  name: string;
  city_id?: number;
  address?: string;
  total_screens: number;
}

export interface OperatorTimelineResponse {
  cinema: { id: number; name: string };
  date: string;
  auditoriums: Array<{
    id: number;
    name: string;
    screen_type?: string;
    total_seats: number;
  }>;
  showtimes: Array<{
    id: number;
    movie_id: number;
    movie_title: string;
    movie_duration: number;
    movie_poster?: string;
    auditorium_id: number;
    auditorium_name: string;
    start_time: string;
    end_time: string;
    cleaning_gap_minutes: number;
    effective_end_time: string;
    format: string;
    language: string;
    status: string;
    cancellation_reason?: string;
    price_rules: Record<string, number>;
  }>;
  movies: Array<{
    id: number;
    title: string;
    duration_minutes: number;
    poster_url?: string;
    certification?: string;
    language?: string;
  }>;
}

export interface SeatPriceMapPreview {
  showtime_id: number;
  movie_title: string;
  cinema_name: string;
  auditorium_name: string;
  start_time: string;
  format: string;
  language: string;
  category_base_prices: Record<string, number>;
  total_seats: number;
  seat_map: Array<{
    seat_id: string;
    row: string;
    number: number;
    category: string;
    base_price: number;
    effective_price: number;
    effective_price_paise: number;
  }>;
}

export interface ShowCancelDryRun {
  dry_run: boolean;
  showtime_id: number;
  movie_title: string;
  cinema_name: string;
  screen_name: string;
  start_time: string;
  status: string;
  affected_bookings_count: number;
  affected_tickets_count: number;
  total_refund_paise: number;
  total_refund_rupees: number;
  affected_bookings: Array<{
    booking_id: number;
    booking_code: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    ticket_count: number;
    seats: string[];
    final_total_paise: number;
    refund_amount_paise: number;
    refund_amount_rupees: number;
  }>;
}

export interface CSVPreviewResult {
  entity_type: string;
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  is_valid: boolean;
  error_report: Array<{
    row: number;
    column: string;
    value?: string;
    error: string;
  }>;
  preview_samples: Array<Record<string, any>>;
}

export interface ImportBatchSummary {
  batch_id: string;
  entity_type: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  status: string;
  created_at: string | null;
  undone_at: string | null;
}

export interface DynamicPricingRuleItem {
  id: number;
  name: string;
  category?: string;
  cinema_id?: number;
  format?: string;
  floor_price: number;
  ceiling_price: number;
  price_multiplier: number;
  flat_adjustment: number;
  min_occupancy_pct: number;
  max_occupancy_pct: number;
  version: number;
  status: string;
  updated_at?: string;
}

export async function getAccessibleCinemas(): Promise<OperatorCinema[]> {
  return apiFetch<OperatorCinema[]>('/admin/schedule/cinemas');
}

export async function getScheduleTimeline(cinemaId: number, date: string): Promise<OperatorTimelineResponse> {
  return apiFetch<OperatorTimelineResponse>(`/admin/schedule/timeline?cinema_id=${cinemaId}&date=${date}`);
}

export async function checkScheduleConflict(params: {
  auditorium_id: number;
  start_time: string;
  duration_minutes: number;
  cleaning_gap_minutes?: number;
  exclude_showtime_id?: number;
}) {
  const query = new URLSearchParams({
    auditorium_id: String(params.auditorium_id),
    start_time: params.start_time,
    duration_minutes: String(params.duration_minutes),
    cleaning_gap_minutes: String(params.cleaning_gap_minutes || 20),
  });
  if (params.exclude_showtime_id) query.append('exclude_showtime_id', String(params.exclude_showtime_id));
  return apiFetch<any>(`/admin/schedule/conflict-check?${query.toString()}`);
}

export async function createScheduleSlot(payload: {
  cinema_id: number;
  auditorium_id: number;
  movie_id: number;
  start_time: string;
  format_type?: string;
  language?: string;
  cleaning_gap_minutes?: number;
  price_tier_rules?: Record<string, number>;
}) {
  return apiFetch<any>('/admin/schedule/slots', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function bulkCopySchedule(payload: {
  cinema_id: number;
  source_date: string;
  target_dates: string[];
  copy_mode?: 'SKIP_CONFLICTS' | 'FAIL_ON_CONFLICT';
}) {
  return apiFetch<any>('/admin/schedule/bulk-copy', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getSeatPriceMapPreview(showtimeId: number): Promise<SeatPriceMapPreview> {
  return apiFetch<SeatPriceMapPreview>(`/admin/schedule/showtimes/${showtimeId}/price-map-preview`);
}

export async function dryRunCancelShow(showtimeId: number): Promise<ShowCancelDryRun> {
  return apiFetch<ShowCancelDryRun>(`/admin/schedule/showtimes/${showtimeId}/cancel-dry-run`, {
    method: 'POST',
  });
}

export async function executeCancelShow(showtimeId: number, mfaCode: string, reason?: string) {
  return apiFetch<any>(`/admin/schedule/showtimes/${showtimeId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ mfa_code: mfaCode, reason: reason || 'Cinema operational cancellation' }),
  });
}

export async function previewCsvImport(csvText: string, entityType: string = 'SHOWTIMES'): Promise<CSVPreviewResult> {
  return apiFetch<CSVPreviewResult>('/admin/schedule/import/preview', {
    method: 'POST',
    body: JSON.stringify({ csv_text: csvText, entity_type: entityType }),
  });
}

export async function executeCsvImport(csvText: string, entityType: string = 'SHOWTIMES', filename: string = 'import.csv') {
  return apiFetch<any>('/admin/schedule/import/execute', {
    method: 'POST',
    body: JSON.stringify({ csv_text: csvText, entity_type: entityType, filename }),
  });
}

export async function undoCsvImport(batchId: string) {
  return apiFetch<any>(`/admin/schedule/import/${batchId}/undo`, {
    method: 'POST',
  });
}

export async function listImportBatches(): Promise<ImportBatchSummary[]> {
  return apiFetch<ImportBatchSummary[]>('/admin/schedule/import/batches');
}

export async function getPricingRules(cinemaId?: number): Promise<{
  rules: DynamicPricingRuleItem[];
  audit_logs: any[];
}> {
  const q = cinemaId ? `?cinema_id=${cinemaId}` : '';
  return apiFetch<any>(`/admin/schedule/pricing-rules${q}`);
}

export async function upsertPricingRule(payload: {
  name: string;
  floor_price: number;
  ceiling_price: number;
  price_multiplier?: number;
  flat_adjustment?: number;
  category?: string;
  cinema_id?: number;
  format_type?: string;
  min_occupancy_pct?: number;
  max_occupancy_pct?: number;
  rule_id?: number;
  reason?: string;
}) {
  return apiFetch<any>('/admin/schedule/pricing-rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


