import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest, ContactStatus } from '../types';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import { logAudit, AuditActions, getRequestInfo } from '../middleware/audit';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '../utils/sanitizer';

/**
 * Cria uma mensagem de contato (público)
 */
export async function createContact(req: Request, res: Response): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const contactData = {
      name: sanitizeText(req.body.name),
      email: sanitizeEmail(req.body.email),
      phone: req.body.phone ? sanitizePhone(req.body.phone) : null,
      subject: sanitizeText(req.body.subject),
      message: sanitizeText(req.body.message),
      status: 'pending' as ContactStatus,
      ip_address: ipAddress,
    };

    // Cria contato
    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (error || !contact) {
      logger.error('Erro ao criar contato:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar mensagem',
      });
      return;
    }

    // Log de auditoria
    await logAudit(AuditActions.CONTACT_CREATE, 'contacts', contact.id, undefined, undefined, { email: contactData.email }, ipAddress ?? undefined, userAgent);

    // Envia notificação para admin
    await emailService.sendContactNotification({
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone || undefined,
      subject: contactData.subject,
      message: contactData.message,
    });

    res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso! Responderemos em breve.',
    });
  } catch (error) {
    logger.error('Erro ao criar contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Lista contatos (admin)
 */
export async function listContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as ContactStatus | undefined;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: contacts, error, count } = await query;

    if (error) {
      logger.error('Erro ao listar contatos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar contatos',
      });
      return;
    }

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Erro ao listar contatos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Marca contato como respondido
 */
export async function markAsResponded(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const { id } = req.params;

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .update({
        status: 'responded',
        responded_at: new Date().toISOString(),
        responded_by: req.user!.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !contact) {
      res.status(404).json({
        success: false,
        message: 'Contato não encontrado',
      });
      return;
    }

    await logAudit(AuditActions.CONTACT_RESPOND, 'contacts', id, req.user!.id, undefined, undefined, ipAddress ?? undefined, userAgent);

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Erro ao atualizar contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}
