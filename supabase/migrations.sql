-- ============================================
-- SOLVERDE - MIGRAÇÕES E FUNÇÕES AUXILIARES
-- ============================================
-- Execute após o schema.sql principal
-- ============================================

-- ============================================
-- FUNÇÃO: Busca de Leads com Full Text Search
-- ============================================
CREATE OR REPLACE FUNCTION search_leads(search_query TEXT)
RETURNS SETOF leads AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM leads
  WHERE 
    to_tsvector('portuguese', name || ' ' || email || ' ' || COALESCE(message, ''))
    @@ plainto_tsquery('portuguese', search_query)
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Dashboard Stats
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_leads', (SELECT COUNT(*) FROM leads),
    'new_leads', (SELECT COUNT(*) FROM leads WHERE status = 'new'),
    'won_leads', (SELECT COUNT(*) FROM leads WHERE status = 'won'),
    'total_simulations', (SELECT COUNT(*) FROM simulations),
    'avg_monthly_savings', (SELECT COALESCE(AVG(monthly_savings), 0) FROM simulations),
    'total_co2_avoided', (SELECT COALESCE(SUM(co2_avoided), 0) FROM simulations),
    'pending_contacts', (SELECT COUNT(*) FROM contacts WHERE status = 'pending'),
    'newsletter_subscribers', (SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true),
    'leads_last_30_days', (
      SELECT COUNT(*) FROM leads 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'conversion_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'won')::DECIMAL / COUNT(*)) * 100, 2)
        ELSE 0 
      END
      FROM leads
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Leads por Período
-- ============================================
CREATE OR REPLACE FUNCTION get_leads_by_period(
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  count BIGINT,
  status lead_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count,
    leads.status
  FROM leads
  WHERE created_at BETWEEN period_start AND period_end
  GROUP BY DATE(created_at), leads.status
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Relatório de Simulações
-- ============================================
CREATE OR REPLACE FUNCTION get_simulation_report(
  period_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  period_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_simulations', COUNT(*),
    'avg_monthly_bill', ROUND(AVG(monthly_bill)::DECIMAL, 2),
    'avg_system_power', ROUND(AVG(system_power)::DECIMAL, 2),
    'avg_monthly_savings', ROUND(AVG(monthly_savings)::DECIMAL, 2),
    'avg_payback_years', ROUND(AVG(payback_years)::DECIMAL, 2),
    'total_potential_co2_avoided', ROUND(SUM(co2_avoided)::DECIMAL, 2),
    'total_potential_investment', ROUND(SUM(system_cost)::DECIMAL, 2),
    'by_region', (
      SELECT json_agg(json_build_object(
        'region', region,
        'count', count,
        'avg_savings', avg_savings
      ))
      FROM (
        SELECT 
          region,
          COUNT(*) as count,
          ROUND(AVG(monthly_savings)::DECIMAL, 2) as avg_savings
        FROM simulations
        WHERE created_at BETWEEN period_start AND period_end
        GROUP BY region
      ) sub
    )
  ) INTO result
  FROM simulations
  WHERE created_at BETWEEN period_start AND period_end;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Arquivar Leads Antigos
-- ============================================
CREATE OR REPLACE FUNCTION archive_old_leads(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  WITH archived AS (
    UPDATE leads
    SET status = 'lost',
        notes = COALESCE(notes, '') || E'\n[Arquivado automaticamente em ' || NOW() || ']'
    WHERE status = 'new'
    AND created_at < NOW() - (days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO archived_count FROM archived;
  
  -- Log da ação
  INSERT INTO audit_logs (action, entity_type, new_data)
  VALUES ('AUTO_ARCHIVE', 'leads', json_build_object('count', archived_count, 'days_old', days_old));
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Exportar Leads para CSV
-- ============================================
CREATE OR REPLACE FUNCTION export_leads_csv(
  status_filter lead_status DEFAULT NULL,
  from_date TIMESTAMPTZ DEFAULT NULL,
  to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  project_type project_type,
  status lead_status,
  monthly_bill DECIMAL,
  region VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.email,
    l.phone,
    l.project_type,
    l.status,
    l.monthly_bill,
    l.region,
    l.created_at
  FROM leads l
  WHERE 
    (status_filter IS NULL OR l.status = status_filter)
    AND (from_date IS NULL OR l.created_at >= from_date)
    AND (to_date IS NULL OR l.created_at <= to_date)
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Notificar novo lead (para webhooks)
-- ============================================
CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_lead',
    json_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'email', NEW.email,
      'project_type', NEW.project_type,
      'monthly_bill', NEW.monthly_bill
    )::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION notify_new_lead();

-- ============================================
-- VIEW: Leads com informações completas
-- ============================================
CREATE OR REPLACE VIEW leads_detailed AS
SELECT 
  l.*,
  u.name as assigned_user_name,
  u.email as assigned_user_email,
  (
    SELECT COUNT(*) 
    FROM simulations s 
    WHERE s.lead_id = l.id
  ) as simulations_count,
  (
    SELECT MAX(created_at) 
    FROM simulations s 
    WHERE s.lead_id = l.id
  ) as last_simulation_at
FROM leads l
LEFT JOIN users u ON l.assigned_to = u.id;

-- ============================================
-- VIEW: Posts publicados (para API pública)
-- ============================================
CREATE OR REPLACE VIEW published_posts AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.excerpt,
  p.content,
  p.featured_image,
  p.views,
  p.read_time,
  p.meta_title,
  p.meta_description,
  p.published_at,
  c.name as category_name,
  c.slug as category_slug,
  u.name as author_name
FROM blog_posts p
JOIN blog_categories c ON p.category_id = c.id
JOIN users u ON p.author_id = u.id
WHERE p.status = 'published'
ORDER BY p.published_at DESC;

-- ============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

-- Índice para busca de leads por período
CREATE INDEX IF NOT EXISTS idx_leads_created_at_range 
ON leads(created_at DESC)
WHERE status != 'lost';

-- Índice para simulações recentes
CREATE INDEX IF NOT EXISTS idx_simulations_recent 
ON simulations(created_at DESC)
WHERE created_at > NOW() - INTERVAL '90 days';

-- Índice para contatos pendentes
CREATE INDEX IF NOT EXISTS idx_contacts_pending 
ON contacts(created_at DESC)
WHERE status = 'pending';

-- ============================================
-- PERMISSÕES PARA SERVICE ROLE
-- ============================================
-- O service_role já tem acesso total, mas
-- garantindo para funções específicas

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO service_role;
GRANT EXECUTE ON FUNCTION search_leads(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_simulation_report(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_leads(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION export_leads_csv(lead_status, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO service_role;

-- ============================================
-- SCHEDULED JOBS (Configure no Supabase)
-- ============================================
-- 
-- 1. Limpeza de tokens (diário às 3h):
--    SELECT cleanup_expired_tokens();
--
-- 2. Arquivar leads antigos (semanal):
--    SELECT archive_old_leads(365);
--
-- 3. Backup (configure no painel)
--
-- ============================================
