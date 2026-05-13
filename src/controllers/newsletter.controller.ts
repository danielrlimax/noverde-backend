import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';
import { sanitizeEmail, sanitizeText } from '../utils/sanitizer';
import { getRequestInfo } from '../middleware/audit';

/**
 * Inscreve na newsletter (público)
 */
export async function subscribe(req: Request, res: Response): Promise<void> {
  const { ipAddress } = getRequestInfo(req);

  try {
    const email = sanitizeEmail(req.body.email);
    const name = req.body.name ? sanitizeText(req.body.name) : null;

    // Verifica se já existe
    const { data: existing } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, is_active')
      .eq('email', email)
      .single();

    if (existing) {
      if (existing.is_active) {
        res.json({
          success: true,
          message: 'Este e-mail já está inscrito na newsletter.',
        });
        return;
      }

      // Reativa inscrição
      await supabaseAdmin
        .from('newsletter_subscribers')
        .update({ is_active: true, unsubscribed_at: null })
        .eq('id', existing.id);

      res.json({
        success: true,
        message: 'Inscrição reativada com sucesso!',
      });
      return;
    }

    // Cria nova inscrição
    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({
        email,
        name,
        is_active: true,
        ip_address: ipAddress,
      });

    if (error) {
      logger.error('Erro ao inscrever na newsletter:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar inscrição',
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Inscrição realizada com sucesso!',
    });
  } catch (error) {
    logger.error('Erro na inscrição:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Cancela inscrição na newsletter (público)
 */
export async function unsubscribe(req: Request, res: Response): Promise<void> {
  try {
    const email = sanitizeEmail(req.body.email);

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      logger.error('Erro ao cancelar inscrição:', error);
    }

    // Sempre retorna sucesso (segurança)
    res.json({
      success: true,
      message: 'Inscrição cancelada com sucesso.',
    });
  } catch (error) {
    logger.error('Erro ao cancelar inscrição:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Lista inscritos (admin)
 */
export async function listSubscribers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const onlyActive = req.query.active !== 'false';
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('newsletter_subscribers')
      .select('*', { count: 'exact' });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    query = query
      .order('subscribed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Erro ao listar inscritos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar inscritos',
      });
      return;
    }

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Erro ao listar inscritos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}
