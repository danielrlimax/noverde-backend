import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (!env.email.user || !env.email.pass) {
      logger.warn('SMTP não configurado. E-mails não serão enviados.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: {
        user: env.email.user,
        pass: env.email.pass,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('Tentativa de envio de e-mail sem SMTP configurado');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: env.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });

      logger.info('E-mail enviado com sucesso', {
        to: options.to,
        subject: options.subject,
      });

      return true;
    } catch (error) {
      logger.error('Erro ao enviar e-mail:', error);
      return false;
    }
  }

  // ========================================
  // TEMPLATES DE E-MAIL
  // ========================================

  private getBaseTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5fbf7; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #40916C 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header span { color: #F9A825; }
          .content { padding: 30px; color: #333; line-height: 1.6; }
          .content h2 { color: #1B4332; }
          .button { display: inline-block; background: #F9A825; color: #1B4332 !important; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; margin: 20px 0; }
          .button:hover { background: #FBC02D; }
          .footer { background: #f5fbf7; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .highlight { background: #f0f9f4; border-left: 4px solid #40916C; padding: 15px; margin: 15px 0; }
          .info-box { background: #e8f5e9; border-radius: 8px; padding: 20px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Sol<span>Verde</span></h1>
            <p style="color: #95D5B2; margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Energia Solar</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>SolVerde Energia Solar</p>
            <p>Av. Paulista, 1578 - São Paulo, SP</p>
            <p>Este e-mail foi enviado automaticamente, por favor não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const content = `
      <h2>Bem-vindo(a) à SolVerde, ${name}!</h2>
      <p>Obrigado por se cadastrar em nossa plataforma. Estamos muito felizes em tê-lo(a) conosco!</p>
      <p>Com a SolVerde, você terá acesso a:</p>
      <ul>
        <li>Simulador de economia de energia solar</li>
        <li>Orçamentos personalizados</li>
        <li>Acompanhamento de projetos</li>
        <li>Conteúdo exclusivo sobre energia renovável</li>
      </ul>
      <p style="text-align: center;">
        <a href="https://solverde.com.br" class="button">Acessar Minha Conta</a>
      </p>
      <p>Se tiver qualquer dúvida, nossa equipe está pronta para ajudar!</p>
    `;

    return this.sendEmail({
      to,
      subject: 'Bem-vindo(a) à SolVerde! 🌞',
      html: this.getBaseTemplate(content),
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<boolean> {
    const content = `
      <h2>Recuperação de Senha</h2>
      <p>Olá, ${name}!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta SolVerde.</p>
      <p>Clique no botão abaixo para criar uma nova senha:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Redefinir Minha Senha</a>
      </p>
      <div class="highlight">
        <p><strong>Importante:</strong> Este link expira em 1 hora.</p>
        <p>Se você não solicitou esta redefinição, ignore este e-mail. Sua senha permanecerá inalterada.</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Recuperação de Senha - SolVerde',
      html: this.getBaseTemplate(content),
    });
  }

  async sendLeadNotification(leadData: {
    name: string;
    email: string;
    phone: string;
    projectType: string;
    message?: string;
    monthlyBill?: number;
  }): Promise<boolean> {
    const content = `
      <h2>🎉 Novo Lead Recebido!</h2>
      <div class="info-box">
        <p><strong>Nome:</strong> ${leadData.name}</p>
        <p><strong>E-mail:</strong> ${leadData.email}</p>
        <p><strong>Telefone:</strong> ${leadData.phone}</p>
        <p><strong>Tipo de Projeto:</strong> ${leadData.projectType}</p>
        ${leadData.monthlyBill ? `<p><strong>Conta de Luz:</strong> R$ ${leadData.monthlyBill.toLocaleString('pt-BR')}</p>` : ''}
        ${leadData.message ? `<p><strong>Mensagem:</strong> ${leadData.message}</p>` : ''}
      </div>
      <p style="text-align: center;">
        <a href="https://admin.solverde.com.br/leads" class="button">Ver no Painel</a>
      </p>
    `;

    return this.sendEmail({
      to: env.email.admin,
      subject: `Novo Lead: ${leadData.name} - ${leadData.projectType}`,
      html: this.getBaseTemplate(content),
      replyTo: leadData.email,
    });
  }

  async sendLeadConfirmation(to: string, name: string): Promise<boolean> {
    const content = `
      <h2>Obrigado pelo seu interesse, ${name}!</h2>
      <p>Recebemos sua solicitação de orçamento com sucesso.</p>
      <p>Nossa equipe de especialistas entrará em contato em até <strong>24 horas úteis</strong> para entender suas necessidades e apresentar a melhor solução em energia solar para você.</p>
      <div class="highlight">
        <p><strong>Enquanto isso, você pode:</strong></p>
        <ul>
          <li>Usar nosso simulador para estimar sua economia</li>
          <li>Conferir nossos casos de sucesso</li>
          <li>Tirar dúvidas no FAQ</li>
        </ul>
      </div>
      <p style="text-align: center;">
        <a href="https://solverde.com.br/#simulador" class="button">Simular Economia</a>
      </p>
    `;

    return this.sendEmail({
      to,
      subject: 'Recebemos sua solicitação! - SolVerde',
      html: this.getBaseTemplate(content),
    });
  }

  async sendContactNotification(contactData: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<boolean> {
    const content = `
      <h2>📬 Nova Mensagem de Contato</h2>
      <div class="info-box">
        <p><strong>Nome:</strong> ${contactData.name}</p>
        <p><strong>E-mail:</strong> ${contactData.email}</p>
        ${contactData.phone ? `<p><strong>Telefone:</strong> ${contactData.phone}</p>` : ''}
        <p><strong>Assunto:</strong> ${contactData.subject}</p>
      </div>
      <div class="highlight">
        <p><strong>Mensagem:</strong></p>
        <p>${contactData.message.replace(/\n/g, '<br>')}</p>
      </div>
      <p style="text-align: center;">
        <a href="https://admin.solverde.com.br/contacts" class="button">Responder</a>
      </p>
    `;

    return this.sendEmail({
      to: env.email.admin,
      subject: `Contato: ${contactData.subject}`,
      html: this.getBaseTemplate(content),
      replyTo: contactData.email,
    });
  }

  async sendSimulationResult(to: string, name: string, simulation: {
    monthlyBill: number;
    monthlySavings: number;
    annualSavings: number;
    systemPower: number;
    panelsNeeded: number;
    paybackYears: number;
    systemCost: number;
  }): Promise<boolean> {
    const content = `
      <h2>Resultado da sua Simulação Solar</h2>
      <p>Olá, ${name}!</p>
      <p>Confira o resultado da simulação de economia com energia solar:</p>
      
      <div class="info-box">
        <h3 style="color: #1B4332; margin-top: 0;">💰 Sua Economia</h3>
        <p><strong>Economia Mensal:</strong> R$ ${simulation.monthlySavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        <p><strong>Economia Anual:</strong> R$ ${simulation.annualSavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        <p><strong>Retorno do Investimento:</strong> ${simulation.paybackYears.toFixed(1)} anos</p>
      </div>

      <div class="info-box">
        <h3 style="color: #1B4332; margin-top: 0;">⚡ Sistema Recomendado</h3>
        <p><strong>Potência:</strong> ${simulation.systemPower.toFixed(1)} kWp</p>
        <p><strong>Painéis Necessários:</strong> ${simulation.panelsNeeded} unidades</p>
        <p><strong>Investimento Estimado:</strong> R$ ${simulation.systemCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
      </div>

      <p style="text-align: center;">
        <a href="https://solverde.com.br/contato" class="button">Solicitar Orçamento Completo</a>
      </p>
      
      <p style="font-size: 12px; color: #666;">
        * Valores estimados baseados em médias regionais. O orçamento definitivo pode variar conforme análise técnica do local.
      </p>
    `;

    return this.sendEmail({
      to,
      subject: `Sua economia estimada: R$ ${simulation.monthlySavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês - SolVerde`,
      html: this.getBaseTemplate(content),
    });
  }
}

export const emailService = new EmailService();
