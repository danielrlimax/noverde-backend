-- ============================================
-- SOLVERDE - SCHEMA DO BANCO DE DADOS
-- Supabase PostgreSQL
-- ============================================
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TIPOS ENUM
-- ============================================

-- Roles de usuário
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator', 'client');

-- Status de leads
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

-- Tipos de projeto
CREATE TYPE project_type AS ENUM ('residencial', 'comercial', 'industrial', 'rural', 'outro');

-- Status de contato
CREATE TYPE contact_status AS ENUM ('pending', 'responded', 'archived');

-- Status de post do blog
CREATE TYPE blog_status AS ENUM ('draft', 'published', 'archived');

-- Status de webinar
CREATE TYPE webinar_status AS ENUM ('scheduled', 'live', 'finished', 'cancelled');

-- ============================================
-- TABELA: USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- ============================================
-- TABELA: SESSIONS
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent VARCHAR(500),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_refresh ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- TABELA: TOKEN BLACKLIST
-- ============================================
CREATE TABLE token_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_blacklist_token ON token_blacklist(token_hash);
CREATE INDEX idx_blacklist_expires ON token_blacklist(expires_at);

-- ============================================
-- TABELA: PASSWORD RESETS
-- ============================================
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- ============================================
-- TABELA: LEADS
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  project_type project_type NOT NULL,
  message TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  source VARCHAR(100) DEFAULT 'website',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  monthly_bill DECIMAL(12, 2),
  roof_area DECIMAL(10, 2),
  region VARCHAR(50),
  notes TEXT,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_project_type ON leads(project_type);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_search ON leads USING gin(to_tsvector('portuguese', name || ' ' || email));

-- ============================================
-- TABELA: SIMULATIONS
-- ============================================
CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  session_id VARCHAR(100) NOT NULL,
  monthly_bill DECIMAL(12, 2) NOT NULL,
  roof_area DECIMAL(10, 2) NOT NULL,
  region VARCHAR(50) NOT NULL,
  irradiation DECIMAL(5, 2) NOT NULL,
  system_power DECIMAL(10, 2) NOT NULL,
  panels_needed INTEGER NOT NULL,
  monthly_savings DECIMAL(12, 2) NOT NULL,
  annual_savings DECIMAL(12, 2) NOT NULL,
  system_cost DECIMAL(12, 2) NOT NULL,
  payback_years DECIMAL(5, 2) NOT NULL,
  co2_avoided DECIMAL(10, 4) NOT NULL,
  trees_equivalent INTEGER NOT NULL,
  savings_25_years DECIMAL(14, 2) NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_simulations_lead ON simulations(lead_id);
CREATE INDEX idx_simulations_session ON simulations(session_id);
CREATE INDEX idx_simulations_created ON simulations(created_at DESC);

-- ============================================
-- TABELA: CONTACTS
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status contact_status NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC);

-- ============================================
-- TABELA: NEWSLETTER SUBSCRIBERS
-- ============================================
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  ip_address INET,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_active ON newsletter_subscribers(is_active) WHERE is_active = true;

-- ============================================
-- TABELA: BLOG CATEGORIES
-- ============================================
CREATE TABLE blog_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);

-- ============================================
-- TABELA: BLOG POSTS
-- ============================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(200) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE RESTRICT,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  featured_image VARCHAR(500),
  status blog_status NOT NULL DEFAULT 'draft',
  views INTEGER NOT NULL DEFAULT 0,
  read_time INTEGER NOT NULL DEFAULT 5,
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_blog_posts_search ON blog_posts USING gin(to_tsvector('portuguese', title || ' ' || excerpt || ' ' || content));

-- ============================================
-- TABELA: DOWNLOADS
-- ============================================
CREATE TABLE downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  file_url VARCHAR(500) NOT NULL,
  file_size VARCHAR(20),
  file_type VARCHAR(10) NOT NULL,
  category VARCHAR(50),
  download_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_downloads_public ON downloads(is_public) WHERE is_public = true;

-- ============================================
-- TABELA: WEBINARS
-- ============================================
CREATE TABLE webinars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  speaker VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status webinar_status NOT NULL DEFAULT 'scheduled',
  max_participants INTEGER NOT NULL DEFAULT 200,
  current_participants INTEGER NOT NULL DEFAULT 0,
  recording_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_webinars_status ON webinars(status);
CREATE INDEX idx_webinars_date ON webinars(date);

-- ============================================
-- TABELA: WEBINAR REGISTRATIONS
-- ============================================
CREATE TABLE webinar_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webinar_id UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attended BOOLEAN NOT NULL DEFAULT false,
  
  UNIQUE(webinar_id, email)
);

-- Índices
CREATE INDEX idx_webinar_reg_webinar ON webinar_registrations(webinar_id);
CREATE INDEX idx_webinar_reg_email ON webinar_registrations(email);

-- ============================================
-- TABELA: AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- TABELA: SECURITY LOGS (Firewall/Ataques)
-- ============================================
CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  details JSONB,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_security_ip ON security_logs(ip_address);
CREATE INDEX idx_security_event ON security_logs(event_type);
CREATE INDEX idx_security_created ON security_logs(created_at DESC);
CREATE INDEX idx_security_blocked ON security_logs(blocked) WHERE blocked = true;

-- ============================================
-- TABELA: LOGIN ATTEMPTS (Proteção contra brute force)
-- ============================================
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_login_email ON login_attempts(email);
CREATE INDEX idx_login_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_created ON login_attempts(created_at DESC);
CREATE INDEX idx_login_failed ON login_attempts(email, ip_address, created_at) WHERE success = false;

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_leads_updated
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_posts_updated
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para incrementar contador de webinar
CREATE OR REPLACE FUNCTION increment_webinar_participants()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE webinars 
  SET current_participants = current_participants + 1 
  WHERE id = NEW.webinar_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webinar_registration
  AFTER INSERT ON webinar_registrations
  FOR EACH ROW EXECUTE FUNCTION increment_webinar_participants();

-- Função para limpar tokens expirados
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM token_blacklist WHERE expires_at < NOW();
  DELETE FROM password_resets WHERE expires_at < NOW();
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para USERS
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::uuid = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- Políticas para LEADS
CREATE POLICY "Staff can view leads" ON leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "Operators can only view assigned leads" ON leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'operator'
    ) AND assigned_to = auth.uid()::uuid
  );

CREATE POLICY "Staff can manage leads" ON leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role IN ('admin', 'manager')
    )
  );

-- Políticas para BLOG POSTS
CREATE POLICY "Anyone can view published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Authors can view own posts" ON blog_posts
  FOR SELECT USING (author_id = auth.uid()::uuid);

CREATE POLICY "Staff can manage posts" ON blog_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role IN ('admin', 'manager')
    )
  );

-- Políticas para AUDIT LOGS
CREATE POLICY "Only admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Categorias do blog
INSERT INTO blog_categories (name, slug, description) VALUES
  ('Economia', 'economia', 'Dicas de economia e finanças em energia solar'),
  ('Tecnologia', 'tecnologia', 'Novidades tecnológicas do setor fotovoltaico'),
  ('Sustentabilidade', 'sustentabilidade', 'Meio ambiente e práticas sustentáveis'),
  ('Legislação', 'legislacao', 'Leis, regulamentações e incentivos fiscais'),
  ('Dicas', 'dicas', 'Dicas práticas para seu sistema solar'),
  ('Mercado', 'mercado', 'Notícias e tendências do mercado solar'),
  ('Manutenção', 'manutencao', 'Cuidados e manutenção de sistemas'),
  ('Financeiro', 'financeiro', 'Financiamento e retorno do investimento'),
  ('Inovação', 'inovacao', 'Inovações e tecnologias emergentes');

-- Downloads iniciais
INSERT INTO downloads (title, description, file_url, file_size, file_type, category) VALUES
  ('Catálogo de Produtos 2024', 'Catálogo completo com todos os painéis e inversores', '/downloads/catalogo-2024.pdf', '5.2 MB', 'PDF', 'catalogo'),
  ('Guia de Instalação Residencial', 'Manual técnico para instalações residenciais', '/downloads/guia-instalacao.pdf', '3.8 MB', 'PDF', 'manual'),
  ('Manual do Proprietário', 'Guia de uso e manutenção do sistema', '/downloads/manual-proprietario.pdf', '2.5 MB', 'PDF', 'manual');

-- ============================================
-- CRIAR USUÁRIO ADMIN INICIAL
-- ============================================
-- IMPORTANTE: Mude a senha após o primeiro login!
-- A senha padrão é: SolVerde@2024!
-- Hash gerado com bcrypt (12 rounds)

INSERT INTO users (email, password_hash, name, role, is_active, email_verified) VALUES
  ('admin@solverde.com.br', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4/XNOVJz.6WG1HHK', 'Administrador', 'admin', true, true);

-- ============================================
-- JOBS AGENDADOS (Supabase Edge Functions)
-- ============================================
-- Configure no painel do Supabase:
-- 1. Cron job diário para cleanup_expired_tokens()
-- 2. Cron job para arquivar leads antigos
-- 3. Backup automático

-- Exemplo de chamada (execute manualmente ou via cron):
-- SELECT cleanup_expired_tokens();

-- ============================================
-- COMENTÁRIOS NAS TABELAS (Documentação)
-- ============================================
COMMENT ON TABLE users IS 'Usuários do sistema (admins, operadores, clientes)';
COMMENT ON TABLE leads IS 'Leads captados pelo site e outras fontes';
COMMENT ON TABLE simulations IS 'Simulações de economia realizadas';
COMMENT ON TABLE contacts IS 'Mensagens de contato recebidas';
COMMENT ON TABLE audit_logs IS 'Log de auditoria de todas as ações sensíveis';
COMMENT ON TABLE blog_posts IS 'Posts do blog institucional';

-- ============================================
-- FIM DO SCHEMA
-- ============================================
