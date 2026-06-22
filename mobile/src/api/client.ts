import axios from 'axios';
import { getApiBase, getAccessToken, clearAccessToken } from '../config/apiBase';

export async function post<T = any>(path: string, body: any, requireAuth: boolean = true): Promise<T> {
  const base = await getApiBase();
  const token = requireAuth ? await getAccessToken() : null;
  const url = `${base}/api/auth${path}`;
  try {
    const { data } = await axios.post<T>(url, body, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    });
    return data;
  } catch (error: any) {
    // If token is invalid, clear it
    if (error?.response?.status === 401 && token) {
      const errorData = error?.response?.data;
      if (errorData?.code === 'token_not_valid' || errorData?.detail?.includes('token')) {
        await clearAccessToken();
      }
    }
    console.log('API error:', {
      url,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

export async function get<T = any>(path: string, requireAuth: boolean = true): Promise<T> {
  const base = await getApiBase();
  const token = requireAuth ? await getAccessToken() : null;
  const url = `${base}/api/auth${path}`;
  try {
    const { data } = await axios.get<T>(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    });
    return data;
  } catch (error: any) {
    // If token is invalid, clear it
    if (error?.response?.status === 401 && token) {
      const errorData = error?.response?.data;
      if (errorData?.code === 'token_not_valid' || errorData?.detail?.includes('token')) {
        await clearAccessToken();
      }
    }
    console.log('API error:', {
      url,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

export async function requestOTP(phone: string): Promise<{ success: boolean; debug_otp?: string }> {
  return await post('/request-otp/', { phone }, false); // Don't require auth
}

export async function verifyOTP(
  phone: string,
  otp: string
): Promise<{ access: string; refresh: string; user: { id: number; phone: string } }> {
  return await post('/verify-otp/', { phone, otp }, false); // Don't require auth
}

// ⚠️ TODO: REMOVE BEFORE PRODUCTION - Development only function for quick login
export async function devLogin(phone: string): Promise<{ access: string; refresh: string; user: { id: number; phone: string } }> {
  return await post('/dev-login/', { phone }, false); // Don't require auth
}

export interface PsychologicalIssue {
  id: number;
  title: string;
  title_fa: string | null;
  description: string | null;
  category: string | null;
  category_id?: number | null;
  category_order?: number;
  order?: number;
  image: string | null;
  image_url: string | null;
  is_active: boolean;
  has_form: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryStat {
  id: number;
  name: string;
  name_fa?: string | null;
  display_name: string;
  description: string | null;
  order: number;
  therapist_count: number;
  sample_profile_image_url: string | null;
}

export interface Question {
  id: number;
  text: string;
  text_fa: string | null;
  question_type: 'yes_no' | 'descriptive' | 'multiple_choice_4' | 'short_text' | 'number';
  options: string | null;
  options_fa: string | null;
  options_list: string[];
  is_required: boolean;
  order: number;
}

export interface Form {
  id: number;
  title: string;
  title_fa: string | null;
  description: string | null;
  is_active: boolean;
  group_therapy_enabled: boolean;
  group_therapy_max_patients: number;
  questions: Question[];
  created_at: string;
  updated_at: string;
}

export interface QuestionAnswer {
  question_id: number;
  answer_text?: string | null;
  answer_number?: number | null;
  answer_boolean?: boolean | null;
}

export interface FormResponseData {
  psychological_issue_id: number;
  answers: QuestionAnswer[];
  is_group_therapy?: boolean;
}

export interface FormResponseResult {
  success: boolean;
  message: string;
  response_id: number;
  session_request_id?: number;
  is_group_therapy?: boolean;
  pending?: boolean;
  current_count?: number;
  required_count?: number;
  patients_count?: number;
}

export async function getPsychologicalIssues(): Promise<PsychologicalIssue[]> {
  return await get<PsychologicalIssue[]>('/psychological-issues/');
}

export async function getCategories(): Promise<CategoryStat[]> {
  return await get<CategoryStat[]>('/categories/');
}

export async function getForm(issueId: number): Promise<Form> {
  return await get<Form>(`/psychological-issues/${issueId}/form/`);
}

export async function submitFormResponse(data: FormResponseData): Promise<FormResponseResult> {
  return await post<FormResponseResult>('/form-responses/submit/', data);
}

export interface UserProfile {
  id: number;
  user_id: number;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: 'M' | 'F' | 'O' | null;
  email: string | null;
  address: string | null;
  city: string | null;
  is_complete: boolean;
  missing_fields: string[];
  created_at: string;
  updated_at: string;
}

export interface UserProfileUpdateData {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O';
  email?: string;
  address?: string;
  city?: string;
}

export async function getUserProfile(): Promise<UserProfile> {
  return await get<UserProfile>('/profile/');
}

export async function updateUserProfile(data: UserProfileUpdateData): Promise<UserProfile> {
  return await post<UserProfile>('/profile/update/', data);
}

// Wallet
export interface Wallet {
  balance: number;
  reserved_balance: number;
  available_balance: number;
  currency: string;
}

export async function getWallet(): Promise<Wallet> {
  return await get<Wallet>('/wallet/');
}

// Therapist acceptance/rejection
export async function acceptTherapist(requestId: number, offerId?: number): Promise<{ success: boolean; message: string; data: any }> {
  return await post(`/session-requests/${requestId}/accept-therapist/`, { offer_id: offerId });
}

export async function rejectTherapist(requestId: number, offerId?: number): Promise<{ success: boolean; message: string; data: any }> {
  return await post(`/session-requests/${requestId}/reject-therapist/`, { offer_id: offerId });
}

export async function acceptSessionRequestOffer(requestId: number, offerId: number): Promise<{ success: boolean; message: string; data: any }> {
  return await post(`/session-requests/${requestId}/offers/${offerId}/accept/`, {});
}

export async function rejectSessionRequestOffer(requestId: number, offerId: number): Promise<{ success: boolean; message: string; offer: any }> {
  return await post(`/session-requests/${requestId}/offers/${offerId}/reject/`, {});
}

export async function submitTherapistOffer(requestId: number, price: number, message?: string): Promise<{ success: boolean; message: string; offer: any }> {
  return await post(`/session-requests/${requestId}/offers/create/`, {
    price,
    message,
  });
}

// Chat interfaces and functions
export interface ChatMessage {
  id: number;
  session: number;
  sender_id: number;
  sender_name: string;
  message_type: 'TEXT' | 'VOICE' | 'IMAGE';
  content: string;
  voice_file: string | null;
  voice_file_url: string | null;
  is_read: boolean;
  is_mine: boolean;
  created_at: string;
}

export interface PatientProfile {
  id: number;
  phone: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
}

export interface TherapySession {
  id: number;
  session_request: number;
  patient: number;
  patient_name: string;
  patient_phone: string;
  therapist: number;
  therapist_profile_id?: number | null;
  therapist_name: string;
  therapist_profile_image_url: string | null;
  therapist_phone: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  is_group_therapy?: boolean;
  patients_count?: number;
  patients_list?: PatientProfile[];
  current_user_id?: number;
  latest_message: ChatMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export async function getTherapySession(sessionId: number): Promise<TherapySession> {
  return await get<TherapySession>(`/therapy-sessions/${sessionId}/`);
}

export async function getTherapySessionByRequest(requestId: number): Promise<TherapySession> {
  return await get<TherapySession>(`/session-requests/${requestId}/therapy-session/`);
}

export async function getSessionRequest(requestId: number): Promise<any> {
  return await get<any>(`/session-requests/${requestId}/`);
}

export interface TherapistOffer {
  id: number;
  session_request: number;
  therapist_id: number;
  therapist_name: string;
  price: number;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  updated_at: string;
}

export interface SessionRequest {
  id: number;
  patient: number;
  patient_name: string;
  patient_phone: string;
  psychological_issue: number;
  psychological_issue_title: string;
  form_response_summary: string[];
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'PENDING_PAYMENT' | 'COMPLETED';
  payment_status: string;
  price: number;
  price_currency: string;
  approved_by?: number;
  denied_by?: number;
  patient_choice?: string;
  patient_accepted_at?: string;
  is_group_therapy: boolean;
  patients_count: number;
  patients_list: any[];
  offers: TherapistOffer[];
  created_at: string;
  updated_at: string;
}

export async function getSessionRequests(): Promise<SessionRequest[]> {
  return await get<SessionRequest[]>('/session-requests/');
}

export async function getChatMessages(sessionId: number): Promise<ChatMessage[]> {
  return await get<ChatMessage[]>(`/therapy-sessions/${sessionId}/messages/`);
}

export async function sendChatMessage(
  sessionId: number, 
  content: string, 
  messageType: 'TEXT' | 'VOICE' | 'IMAGE' = 'TEXT',
  voiceFile?: { uri: string; type: string; name: string }
): Promise<ChatMessage> {
  const base = await getApiBase();
  const token = await getAccessToken();
  const url = `${base}/api/auth/therapy-sessions/${sessionId}/messages/send/`;
  
  const formData = new FormData();
  formData.append('content', content);
  formData.append('message_type', messageType);
  
  if (messageType === 'VOICE' && voiceFile) {
    formData.append('voice_file', {
      uri: voiceFile.uri,
      type: voiceFile.type || 'audio/m4a',
      name: voiceFile.name || 'voice.m4a',
    } as any);
  }
  
  try {
    const { data } = await axios.post<ChatMessage>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 30000, // Longer timeout for file uploads
    });
    return data;
  } catch (error: any) {
    console.log('API error:', {
      url,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

export async function markMessagesAsRead(sessionId: number): Promise<{ success: boolean; message: string; updated_count: number }> {
  return await post(`/therapy-sessions/${sessionId}/messages/read/`, {});
}

export async function listMyTherapySessions(): Promise<TherapySession[]> {
  return await get<TherapySession[]>('/therapy-sessions/');
}

// Support Chat API functions
export interface SupportChatMessage {
  id: number;
  user: number;
  sender_id: number;
  sender_name: string;
  is_support_staff: boolean;
  message_type: 'TEXT' | 'VOICE' | 'IMAGE';
  content: string;
  voice_file: string | null;
  voice_file_url: string | null;
  is_read: boolean;
  is_mine: boolean;
  created_at: string;
}

export async function getSupportMessages(): Promise<SupportChatMessage[]> {
  return await get<SupportChatMessage[]>('/support/messages/');
}

export async function sendSupportMessage(
  content: string,
  messageType: 'TEXT' | 'VOICE' | 'IMAGE' = 'TEXT',
  voiceFile?: { uri: string; type: string; name: string }
): Promise<SupportChatMessage> {
  const base = await getApiBase();
  const token = await getAccessToken();
  const url = `${base}/api/auth/support/messages/send/`;
  
  const formData = new FormData();
  formData.append('content', content);
  formData.append('message_type', messageType);
  
  if (messageType === 'VOICE' && voiceFile) {
    formData.append('voice_file', {
      uri: voiceFile.uri,
      type: voiceFile.type || 'audio/m4a',
      name: voiceFile.name || 'voice.m4a',
    } as any);
  }
  
  try {
    const { data } = await axios.post<SupportChatMessage>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 30000, // Longer timeout for file uploads
    });
    return data;
  } catch (error: any) {
    console.log('API error:', {
      url,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

export async function markSupportMessagesAsRead(): Promise<{ success: boolean; message: string; updated_count: number }> {
  return await post('/support/messages/read/', {});
}

// Skyroom video call functions
const SKYROOM_API_KEY = 'apikey-43539930-6-fb2201e9baa12459ce8c50c1c3109827';
const SKYROOM_API_BASE = `https://www.skyroom.online/skyroom/api/${SKYROOM_API_KEY}`;

interface SkyroomApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  error_message?: string;
}

async function callSkyroomApi<T>(action: string, params: any = {}): Promise<T> {
  try {
    const { data } = await axios.post<SkyroomApiResponse<T>>(SKYROOM_API_BASE, {
      action,
      params,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (!data.ok) {
      throw new Error(data.error_message || `Skyroom API error: ${data.error_code}`);
    }

    if (data.result === undefined) {
      throw new Error('Skyroom API returned no result');
    }

    return data.result;
  } catch (error: any) {
    console.log('Skyroom API error:', {
      action,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

export interface SkyroomRoom {
  id: number;
  service_id: number;
  name: string;
  title: string;
  description: string | null;
  status: number;
  guest_login: boolean;
  guest_limit: number;
  op_login_first: boolean;
  max_users: number;
  session_duration: number | null;
  time_limit: number | null;
  time_usage: number;
  time_total: number;
  create_time: number;
  update_time: number;
}

export interface SkyroomService {
  id: number;
  status?: number;
  title?: string;
  name?: string;
}

export interface SkyroomLoginUrlParams {
  room_id: number;
  user_id: string;
  nickname: string;
  access?: number; // 1: normal, 2: presenter, 3: operator
  concurrent?: number; // default: 1
  language?: string; // 'fa' or 'en', default: 'fa'
  ttl?: number; // Time to live in seconds, default: 3600
}

let skyroomServiceId: number | null = null;

async function getActiveSkyroomServiceId(): Promise<number> {
  if (skyroomServiceId) {
    return skyroomServiceId;
  }

  const services = await callSkyroomApi<SkyroomService[]>('getServices');
  const activeService = services.find((service) => service.status === 1) || services[0];

  if (!activeService?.id) {
    throw new Error('هیچ سرویس فعالی در Skyroom پیدا نشد');
  }

  skyroomServiceId = activeService.id;
  return skyroomServiceId;
}

/**
 * Create a Skyroom room for a therapy session
 */
export async function createSkyroomRoom(
  sessionId: number,
  title: string
): Promise<number> {
  const roomName = `therapy-session-${sessionId}`;
  const serviceId = await getActiveSkyroomServiceId();

  return await callSkyroomApi<number>('createRoom', {
    service_id: serviceId,
    name: roomName,
    title: title,
    guest_login: false,
    op_login_first: false,
    max_users: 10,
  });
}

/**
 * Get Skyroom room by name or ID
 */
export async function getSkyroomRoom(roomIdOrName: number | string): Promise<SkyroomRoom> {
  const params = typeof roomIdOrName === 'number' 
    ? { room_id: roomIdOrName }
    : { name: roomIdOrName };
  return await callSkyroomApi<SkyroomRoom>('getRoom', params);
}

/**
 * Create a direct login URL for Skyroom room
 */
export async function createSkyroomLoginUrl(params: SkyroomLoginUrlParams): Promise<string> {
  return await callSkyroomApi<string>('createLoginUrl', {
    room_id: params.room_id,
    user_id: params.user_id,
    nickname: params.nickname,
    access: params.access || 1,
    concurrent: params.concurrent || 1,
    language: params.language || 'fa',
    ttl: params.ttl || 3600,
  });
}

// Post API functions
export interface Post {
  id: number;
  therapist_id: number;
  therapist_name: string;
  therapist_profile_image_url: string | null;
  post_type: 'TEXT' | 'IMAGE' | 'VIDEO';
  post_type_display: string;
  content: string;
  image: string | null;
  image_url: string | null;
  video: string | null;
  video_url: string | null;
  is_active: boolean;
  reactions_count: number;
  reactions_by_type: Record<string, number>;
  user_reaction: { reaction_type: string; reaction_type_display: string } | null;
  created_at: string;
  updated_at: string;
}

export interface PostReaction {
  id: number;
  user_id: number;
  user_name: string;
  reaction_type: 'LIKE' | 'LOVE' | 'SUPPORT' | 'THANKS' | 'INSIGHTFUL';
  reaction_type_display: string;
  created_at: string;
}

export async function listPosts(): Promise<Post[]> {
  return await get<Post[]>('/posts/');
}

export async function getPostDetail(postId: number): Promise<Post> {
  return await get<Post>(`/posts/${postId}/`);
}

export async function addPostReaction(postId: number, reactionType: string): Promise<{ success: boolean; message: string; reaction: PostReaction }> {
  return await post<{ success: boolean; message: string; reaction: PostReaction }>(`/posts/${postId}/reactions/add/`, {
    reaction_type: reactionType,
  });
}

export async function removePostReaction(postId: number): Promise<{ success: boolean; message: string }> {
  const base = await getApiBase();
  const token = await getAccessToken();
  const url = `${base}/api/auth/posts/${postId}/reactions/remove/`;
  try {
    const { data } = await axios.delete<{ success: boolean; message: string }>(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    });
    return data;
  } catch (error: any) {
    console.log('API error:', {
      url,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

export async function listPostReactions(postId: number): Promise<PostReaction[]> {
	return await get<PostReaction[]>(`/posts/${postId}/reactions/`);
}

// Notification API functions
export interface Notification {
	id: number;
	title: string;
	message: string;
	sent_by: number | null;
	sent_by_username: string | null;
	sent_at: string;
	is_read: boolean;
	read_at: string | null;
}

export async function listNotifications(): Promise<Notification[]> {
	return await get<Notification[]>('/notifications/');
}

export async function markNotificationAsRead(notificationId: number): Promise<Notification> {
	return await post<Notification>(`/notifications/${notificationId}/read/`, {});
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; message: string; updated_count: number }> {
	return await post('/notifications/read-all/', {});
}
