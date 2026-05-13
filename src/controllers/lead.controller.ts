import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest, CreateLeadDTO, LeadStatus } from '../types';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import { logAudit, AuditActions, getRequestInfo } from '../middleware/audit';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '../utils/sanitizer';

/**
 * Cria um novo lead (público)
 */
export async function createLead(req: Request, res: Response): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const leadData: CreateLeadDTO = {
      name: sanitizeText(req.body.name),
      email: sanitizeEmail(req.body.email),
      phone: sanitizePhone(req.body.phone),
      project_type: req.body.project_type,
      message: req.body.message ? sanitizeText(req.body.message) : undefined,
      source: req.body.source || 'website',
      monthly_bill: req.body.monthly_bill,
      roof_area: req.body.roof_area,
      region: req.body.region,
    };

    // Verifica se já existe lead com mesmo e-mail nas últimas 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('email', leadData.email)
      .gte('created_at', oneDayAgo)
      .single();

    if (existing) {
      res.status(200).json({
        success: true,
        message: 'Já recebemos sua solicitação. Entraremos em contato em breve!',
      });
      return;
    }

    // Cria lead
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        ...leadData,
        status: 'new' as LeadStatus,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error || !lead) {
      logger.error('Erro ao criar lead:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar solicitação',
      });
      return;
    }

    // Log de auditoria
    await logAudit(AuditActions.LEAD_CREATE, 'leads', lead.id, undefined, undefined, { email: leadData.email }, ipAddress ?? undefined, userAgent);

    // Envia e-mail de notificação para admin
    await emailService.sendLeadNotification({
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      projectType: leadData.project_type,
      message: leadData.message,
      monthlyBill: leadData.monthly_bill,
    });

    // Envia e-mail de confirmação para o cliente
    await emailService.sendLeadConfirmation(leadData.email, leadData.name);

    res.status(201).json({
      success: true,
      message: 'Solicitação recebida com sucesso! Entraremos em contato em breve.',
      data: { id: lead.id },
    });
  } catch (error) {
    logger.error('Erro ao criar lead:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Lista leads (admin/manager)
 */
export async function listLeads(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as LeadStatus | undefined;
    const projectType = req.query.project_type as string | undefined;
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('leads')
      .select('*, assigned_user:users!leads_assigned_to_fkey(id, name)', { count: 'exact' });

    // Filtros
    if (status) {
      query = query.eq('status', status);
    }
    if (projectType) {
      query = query.eq('project_type', projectType);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Se for operator, mostra apenas leads atribuídos
    if (req.user!.role === 'operator') {
      query = query.eq('assigned_to', req.user!.id);
    }

    // Ordenação e paginação
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: leads, error, count } = await query;

    if (error) {
      logger.error('Erro ao listar leads:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar leads',
      });
      return;
    }

    res.json({
      success: true,
      data: leads,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Erro ao listar leads:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Busca lead por ID
 */
export async function getLead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('*, assigned_user:users!leads_assigned_to_fkey(id, name, email), simulations(*)')
      .eq('id', id)
      .single();

    if (error || !lead) {
      res.status(404).json({
        success: false,
        message: 'Lead não encontrado',
      });
      return;
    }

    // Verifica permissão
    if (req.user!.role === 'operator' && lead.assigned_to !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'Acesso não autorizado',
      });
      return;
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    logger.error('Erro ao buscar lead:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Atualiza lead
 */
export async function updateLead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const { id } = req.params;
    const { status, assigned_to, notes } = req.body;

    // Busca lead atual
    const { data: currentLead, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentLead) {
      res.status(404).json({
        success: false,
        message: 'Lead não encontrado',
      });
      return;
    }

    // Verifica permissão
    if (req.user!.role === 'operator' && currentLead.assigned_to !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'Acesso não autorizado',
      });
      return;
    }

    // Prepara dados de atualização
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (notes !== undefined) updateData.notes = sanitizeText(notes);

    // Atualiza
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !lead) {
      logger.error('Erro ao atualizar lead:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar lead',
      });
      return;
    }

    // Log de auditoria
    const action = status ? AuditActions.LEAD_STATUS_CHANGE : assigned_to !== undefined ? AuditActions.LEAD_ASSIGN : AuditActions.LEAD_UPDATE;
    await logAudit(action, 'leads', id, req.user!.id, { status: currentLead.status, assigned_to: currentLead.assigned_to }, updateData, ipAddress ?? undefined, userAgent);

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    logger.error('Erro ao atualizar lead:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Estatísticas de leads (dashboard)
 */
export async function getLeadStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Total por status
    const { data: statusStats } = await supabaseAdmin
      .from('leads')
      .select('status')
      .then(result => {
        if (!result.data) return { data: [] };
        const counts: Record<string, number> = {};
        result.data.forEach(lead => {
          counts[lead.status] = (counts[lead.status] || 0) + 1;
        });
        return { data: Object.entries(counts).map(([status, count]) => ({ status, count })) };
      });

    // Leads por tipo de projeto
    const { data: typeStats } = await supabaseAdmin
      .from('leads')
      .select('project_type')
      .then(result => {
        if (!result.data) return { data: [] };
        const counts: Record<string, number> = {};
        result.data.forEach(lead => {
          counts[lead.project_type] = (counts[lead.project_type] || 0) + 1;
        });
        return { data: Object.entries(counts).map(([type, count]) => ({ type, count })) };
      });

    // Leads nos últimos 30 dias
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    // Taxa de conversão
    const { count: totalLeads } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true });

    const { count: wonLeads } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'won');

    const conversionRate = totalLeads && wonLeads ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';

    res.json({
      success: true,
      data: {
        statusStats,
        typeStats,
        recentLeads: recentCount || 0,
        totalLeads: totalLeads || 0,
        wonLeads: wonLeads || 0,
        conversionRate: parseFloat(conversionRate),
      },
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}
