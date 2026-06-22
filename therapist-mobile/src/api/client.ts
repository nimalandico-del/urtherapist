import axios from 'axios';
import { getApiBase, getAccessToken } from '../config/apiBase';

async function post<T = any>(path: string, body: any, requireAuth: boolean = true): Promise<T> {
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
    console.log('API error:', {
      url,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
}

async function put<T = any>(path: string, body: any): Promise<T> {
  const base = await getApiBase();
  const token = await getAccessToken();
  const url = `${base}/api/auth${path}`;
  try {
    const { data } = await axios.put<T>(url, body, {
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

async function patch<T = any>(path: string, body: any): Promise<T> {
  const base = await getApiBase();
  const token = await getAccessToken();
  const url = `${base}/api/auth${path}`;
  try {
    const { data } = await axios.patch<T>(url, body, {
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

async function get<T = any>(path: string): Promise<T> {
  const base = await getApiBase();
  const token = await getAccessToken();
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
  return await post('/request-otp/', { phone }, false);
}

export async function verifyOTP(
  phone: string,
  otp: string
): Promise<{ access: string; refresh: string; user: { id: number; phone: string } }> {
  return await post('/verify-otp/', { phone, otp }, false);
}

// ⚠️ TODO: REMOVE BEFORE PRODUCTION - Development only function for quick login
export async function devLogin(phone: string): Promise<{ access: string; refresh: string; user: { id: number; phone: string } }> {
  return await post('/dev-login/', { phone }, false); // Don't require auth
}

export interface PatientProfile {
  id: number;
  phone: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
}

export interface SessionRequest {
  id: number;
  patient: number;
  patient_name: string;
  patient_phone: string;
  psychological_issue: number;
  psychological_issue_title: string;
  form_response: number;
  form_response_summary: string[];
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  approved_by: number | null;
  denied_by: number | null;
  patient_choice?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  patient_accepted_at?: string | null;
  is_group_therapy?: boolean;
  patients_count?: number;
  patients_list?: PatientProfile[];
  created_at: string;
  updated_at: string;
}

export async function getSessionRequests(): Promise<SessionRequest[]> {
  return await get<SessionRequest[]>('/session-requests/');
}

export async function getSessionRequest(requestId: number): Promise<SessionRequest> {
  return await get<SessionRequest>(`/session-requests/${requestId}/`);
}

export async function approveSessionRequest(requestId: number): Promise<{ success: boolean; message: string; data: SessionRequest }> {
  return await post(`/session-requests/${requestId}/approve/`, {});
}

export async function denySessionRequest(requestId: number): Promise<{ success: boolean; message: string; data: SessionRequest }> {
  return await post(`/session-requests/${requestId}/deny/`, {});
}

export async function submitTherapistOffer(requestId: number, price: number, message?: string): Promise<{ success: boolean; message: string; offer: any }> {
  return await post(`/session-requests/${requestId}/offers/create/`, {
    price,
    message,
  });
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

// Therapist Profile interfaces and functions
export interface CategoryOption {
  id: number;
  name: string;
  name_fa: string | null;
  display_name: string;
  description: string | null;
  order: number;
}

export interface TherapistProfile {
  id: number;
  user_id: number;
  user_phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  bio: string | null;
  profile_image: string | null;
  profile_image_url: string | null;
  activity_categories: CategoryOption[];
  activity_category_ids: number[];
  specializations: string[];
  years_of_experience: number | null;
  education: string | null;
  certificates: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  is_approved: boolean;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TherapistProfileUpdateData {
  first_name?: string;
  last_name?: string;
  bio?: string;
  profile_image?: any;
  activity_categories?: number[];
  specializations?: string[];
  years_of_experience?: number;
  education?: string;
  certificates?: string[];
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

export async function getTherapistProfile(): Promise<TherapistProfile> {
  return await get<TherapistProfile>('/therapist/profile/');
}

export async function getCategories(): Promise<CategoryOption[]> {
  return await get<CategoryOption[]>('/categories/');
}

export async function createOrUpdateTherapistProfile(data: TherapistProfileUpdateData): Promise<TherapistProfile> {
  const normalizedProfileImage = normalizeUploadFile(data.profile_image, 'therapist-profile');
  const normalizedData = normalizedProfileImage
    ? { ...data, profile_image: normalizedProfileImage }
    : data;
  const hasFile = !!normalizedProfileImage;
  const body = hasFile ? buildTherapistProfileFormData(normalizedData) : normalizedData;

  return hasFile
    ? await postWithFormData<TherapistProfile>('/therapist/profile/update/', body as FormData)
    : await post<TherapistProfile>('/therapist/profile/update/', body);
}

function appendProfileValue(formData: FormData, key: string, value: any) {
  if (value === undefined || value === null) return;

  if (Array.isArray(value) || typeof value === 'object') {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
}

function buildTherapistProfileFormData(data: TherapistProfileUpdateData): FormData {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'profile_image') return;
    appendProfileValue(formData, key, value);
  });

  if (data.profile_image) {
    formData.append('profile_image', data.profile_image);
  }

  return formData;
}

function normalizeUploadFile(file: any, fallbackPrefix: string): any {
  if (!file) return undefined;
  if (typeof file === 'string') {
    const uri = file;
    const filename = uri.split('/').pop() || `${fallbackPrefix}.jpg`;
    const cleanFilename = filename.split('?')[0];
    const extension = cleanFilename.includes('.') ? cleanFilename.split('.').pop()?.toLowerCase() : undefined;
    const type =
      extension === 'png'
        ? 'image/png'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : extension === 'webp'
            ? 'image/webp'
            : 'image/jpeg';

    return {
      uri,
      name: cleanFilename,
      type,
    } as any;
  }

  if (typeof file === 'object' && file.uri) {
    const normalizedFromUri = normalizeUploadFile(String(file.uri), fallbackPrefix) || {};
    return {
      ...normalizedFromUri,
      uri: String(file.uri),
      name: file.name ? String(file.name) : normalizedFromUri.name,
      type: file.type ? String(file.type) : normalizedFromUri.type,
    } as any;
  }

  return file;
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

export interface TherapySession {
  id: number;
  session_request: number;
  patient: number;
  patient_name: string;
  patient_phone: string;
  therapist: number;
  therapist_name: string;
  therapist_phone: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
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

export async function listMyTherapySessions(): Promise<TherapySession[]> {
  return await get<TherapySession[]>('/therapy-sessions/');
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

export async function endTherapySession(sessionId: number): Promise<TherapySession> {
  return await post<TherapySession>(`/therapy-sessions/${sessionId}/end/`, {});
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

async function postWithFormData<T = any>(path: string, formData: FormData, requireAuth: boolean = true): Promise<T> {
  const base = await getApiBase();
  const token = requireAuth ? await getAccessToken() : null;
  const url = `${base}/api/auth${path}`;
  try {
    const { data } = await axios.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 60000, // Longer timeout for file uploads
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

export async function listPosts(): Promise<Post[]> {
  return await get<Post[]>('/posts/');
}

export async function getPostDetail(postId: number): Promise<Post> {
  return await get<Post>(`/posts/${postId}/`);
}

export async function createPost(
  postType: 'TEXT' | 'IMAGE' | 'VIDEO',
  content: string,
  imageUri?: string,
  videoUri?: string
): Promise<Post> {
  const formData = new FormData();
  formData.append('post_type', postType);
  formData.append('content', content);
  
  if (postType === 'IMAGE' && imageUri) {
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: type,
    } as any);
  }
  
  if (postType === 'VIDEO' && videoUri) {
    const filename = videoUri.split('/').pop() || 'video.mp4';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : 'video/mp4';
    formData.append('video', {
      uri: videoUri,
      name: filename,
      type: type,
    } as any);
  }
  
  return await postWithFormData<Post>('/posts/create/', formData);
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
