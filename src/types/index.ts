import { Request } from 'express';

// ========================================
// USER TYPES
// ========================================
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'client';

export interface UserPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

// ========================================
// LEAD TYPES
// ========================================
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  project_type: ProjectType;
  message?: string;
  status: LeadStatus;
  source: string;
  assigned_to?: string;
  monthly_bill?: number;
  roof_area?: number;
  region?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

export type ProjectType = 'residencial' | 'comercial' | 'industrial' | 'rural' | 'outro';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface CreateLeadDTO {
  name: string;
  email: string;
  phone: string;
  project_type: ProjectType;
  message?: string;
  source?: string;
  monthly_bill?: number;
  roof_area?: number;
  region?: string;
}

// ========================================
// SIMULATION TYPES
// ========================================
export interface Simulation {
  id: string;
  lead_id?: string;
  session_id: string;
  monthly_bill: number;
  roof_area: number;
  region: string;
  irradiation: number;
  system_power: number;
  panels_needed: number;
  monthly_savings: number;
  annual_savings: number;
  system_cost: number;
  payback_years: number;
  co2_avoided: number;
  trees_equivalent: number;
  savings_25_years: number;
  ip_address?: string;
  created_at: string;
}

export interface CreateSimulationDTO {
  monthly_bill: number;
  roof_area: number;
  region: string;
  session_id?: string;
}

// ========================================
// CONTACT TYPES
// ========================================
export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactStatus;
  responded_at?: string;
  responded_by?: string;
  ip_address?: string;
  created_at: string;
}

export type ContactStatus = 'pending' | 'responded' | 'archived';

export interface CreateContactDTO {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// ========================================
// BLOG TYPES
// ========================================
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category_id: string;
  author_id: string;
  featured_image?: string;
  status: BlogStatus;
  views: number;
  read_time: number;
  meta_title?: string;
  meta_description?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export type BlogStatus = 'draft' | 'published' | 'archived';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

// ========================================
// NEWSLETTER TYPES
// ========================================
export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at?: string;
}

// ========================================
// AUDIT LOG TYPES
// ========================================
export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ========================================
// SESSION TYPES
// ========================================
export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  refresh_token_hash: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  created_at: string;
  last_activity_at: string;
}

// ========================================
// API RESPONSE TYPES
// ========================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  pagination?: Pagination;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ========================================
// DOWNLOAD TYPES
// ========================================
export interface Download {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_size: string;
  file_type: string;
  category: string;
  download_count: number;
  is_public: boolean;
  created_at: string;
}

// ========================================
// WEBINAR TYPES
// ========================================
export interface Webinar {
  id: string;
  title: string;
  description: string;
  speaker: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: WebinarStatus;
  max_participants: number;
  current_participants: number;
  recording_url?: string;
  created_at: string;
}

export type WebinarStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';

export interface WebinarRegistration {
  id: string;
  webinar_id: string;
  name: string;
  email: string;
  phone?: string;
  registered_at: string;
  attended: boolean;
}
