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
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(errorDetail || `API request failed with status ${response.status}`);
  }

  return response.json();
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

// ---------------- MOVIES ----------------
export interface Movie {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  poster_url: string;
  banner_url: string;
  trailer_url?: string;
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
  certificate?: string;
  status?: 'now_showing' | 'coming_soon';
  search?: string;
  sort?: 'popularity' | 'rating' | 'release_date' | 'title';
  page?: number;
  page_size?: number;
} = {}): Promise<Movie[]> {
  const query = new URLSearchParams();
  if (params.city_id) query.set('city_id', params.city_id.toString());
  if (params.genre) query.set('genre', params.genre);
  if (params.language) query.set('language', params.language);
  if (params.format) query.set('format', params.format);
  if (params.certificate) query.set('certificate', params.certificate);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', params.page.toString());
  if (params.page_size) query.set('page_size', params.page_size.toString());

  return apiFetch<Movie[]>(`/movies/?${query.toString()}`);
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
  address: string;
  cancellation_policy: string;
  facilities: string[];
  showtimes: ShowtimeSlot[];
}

export async function getMovieShowtimes(
  movieId: number,
  cityId?: number,
  targetDate?: string,
  format?: string,
  language?: string
): Promise<CinemaShowtimesGroup[]> {
  const query = new URLSearchParams();
  if (cityId) query.set('city_id', cityId.toString());
  if (targetDate) query.set('target_date', targetDate);
  if (format) query.set('format', format);
  if (language) query.set('language', language);

  return apiFetch<CinemaShowtimesGroup[]>(`/movies/${movieId}/showtimes?${query.toString()}`);
}

// ---------------- CINEMAS ----------------
export interface Cinema {
  id: number;
  city_id: number;
  name: string;
  slug: string;
  address: string;
  cancellation_policy: string;
  facilities: string[];
  images: string[];
}

export async function getCinemas(cityId?: number): Promise<Cinema[]> {
  const query = cityId ? `?city_id=${cityId}` : '';
  return apiFetch<Cinema[]>(`/cinemas/${query}`);
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
  targetDate?: string
): Promise<CinemaMovieShowtimes[]> {
  const query = targetDate ? `?target_date=${targetDate}` : '';
  return apiFetch<CinemaMovieShowtimes[]>(`/cinemas/${cinemaId}/showtimes${query}`);
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
export interface SeatInventoryItem {
  seat_id: string;
  category: string;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'PAYMENT_PENDING';
  held_by_current_user: boolean;
  row: string;
  number: number;
  node_name: string;
  distance_to_screen: number;
  vertical_angle_deg: number;
  horizontal_angle_deg: number;
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
  has_3d_preview: boolean;
  format: string;
  language: string;
  start_time: string;
  glb_path: string;
  layout_path: string;
  trailer_url?: string;
  poster_url?: string;
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

export interface BookingResponse {
  id: number;
  booking_code: string;
  showtime_id: number;
  movie_title: string;
  movie_poster_url: string;
  cinema_name: string;
  cinema_address: string;
  auditorium_name: string;
  screen_type: string;
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
  };
}

export async function createBooking(data: {
  showtime_id: number;
  hold_id: string;
  seat_ids: string[];
  addons?: { fnb_item_id: number; quantity: number }[];
  coupon_code?: string;
  contact_email: string;
  contact_phone: string;
}): Promise<BookingResponse> {
  return apiFetch<BookingResponse>('/bookings/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getBooking(id: number | string): Promise<BookingResponse> {
  return apiFetch<BookingResponse>(`/bookings/${id}`);
}

export async function cancelBooking(id: number | string): Promise<{
  booking_id: number;
  status: string;
  refund_amount: number;
  message: string;
}> {
  return apiFetch(`/bookings/${id}/cancel`, { method: 'POST' });
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

export function logoutUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cineverse_token');
    localStorage.removeItem('cineverse_user');
  }
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

